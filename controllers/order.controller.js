import Order from "../models/order.model.js";
import Product from "../models/product.models.js";
import mongoose from "mongoose";
import Address from "../models/address.model.js";
import User from "../models/user.model.js";
import { sendOrderDecisionEmail } from "../services/email.service.js";

const splitName = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" "),
  };
};

const resolveOrderAddress = async (address, userId, user) => {
  if (typeof address === "string" && mongoose.Types.ObjectId.isValid(address)) {
    const addressDoc = await Address.findById(address);
    if (!addressDoc || addressDoc.userId !== userId.toString()) {
      return null;
    }
    return address;
  }

  if (address && typeof address === "object") {
    const { firstName, lastName } = splitName(user?.name);
    const normalizedAddress = {
      firstName: address.firstName || firstName,
      lastName: address.lastName || lastName,
      email: address.email || user?.email || "",
      street: address.street || address.address || "",
      city: address.city || "",
      state: address.state || "",
      country: address.country || "India",
      zipCode: address.zipCode || address.zipcode || address.pincode || "",
      phone: address.phone || address.phoneNumber || "",
    };

    const hasRequiredAddress = [
      normalizedAddress.street,
      normalizedAddress.city,
      normalizedAddress.state,
      normalizedAddress.zipCode,
      normalizedAddress.phone,
      normalizedAddress.email,
    ].every((value) => String(value).trim());

    if (!hasRequiredAddress) {
      return null;
    }

    return normalizedAddress;
  }

  return null;
};

const hydrateOrderAddress = async (order) => {
  const plainOrder = typeof order.toObject === "function" ? order.toObject() : order;
  const address = plainOrder.address;

  if (
    (typeof address === "string" && mongoose.Types.ObjectId.isValid(address)) ||
    address instanceof mongoose.Types.ObjectId
  ) {
    plainOrder.address = await Address.findById(address).lean();
  }

  return plainOrder;
};

// Place order COD: /api/order/place

export const placeOrderCOD = async (req, res) => {
  try {
    const userId = req.user;
    const { items, address } = req.body;
    if (!address || !items || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid order details", success: false });
    }

    const user = await User.findById(userId).select("name email");
    if (!user) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    const orderAddress = await resolveOrderAddress(address, userId, user);
    if (!orderAddress) {
      return res
        .status(403)
        .json({ message: "Invalid delivery address", success: false });
    }

    let amount = 0;
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res
          .status(400)
          .json({ message: "One or more products are invalid", success: false });
      }
      if (!item.quantity || item.quantity < 1 || item.quantity > 99) {
        return res
          .status(400)
          .json({ message: "Invalid item quantity", success: false });
      }
      amount += product.offerPrice * item.quantity;
    }

    // Add tax charge 5% (consistent with Cart.jsx)
    amount += (amount * 5) / 100;

    await Order.create({
      userId,
      items,
      address: orderAddress,
      amount,
      paymentType: "COD",
      isPaid: false,
    });

    res
      .status(201)
      .json({ message: "Order placed successfully", success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// oredr details for individual user :/api/order/user
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user;
    let orders = await Order.find({
      userId,
      $or: [{ paymentType: "COD" }, { isPaid: true }],
    })
      .populate("items.product")
      .sort({ createdAt: -1 });

    // Manually populate address if it's a string (ID)
    orders = await Promise.all(orders.map(hydrateOrderAddress));

    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// get all orders for admin :/api/order/seller
export const getAllOrders = async (req, res) => {
  try {
    let orders = await Order.find({
      $or: [{ paymentType: "COD" }, { isPaid: true }],
    })
      .populate("items.product userId")
      .sort({ createdAt: -1 });

    orders = await Promise.all(orders.map(hydrateOrderAddress));

    console.log("Orders API response - Count:", orders.length);
    // Log first order for debugging data structure
    if (orders.length > 0) {
      console.log("First Order Item Product Sample:", orders[0].items[0]?.product ? "Populated" : "Not Populated");
    }

    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Error in getAllOrders:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Update order status: /api/order/status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    
    const updateData = { status };
    
    // If status is "Delivered", we can assume it's paid for COD
    if (status === "Delivered") {
        updateData.isPaid = true;
    }

    const order = await Order.findByIdAndUpdate(orderId, updateData, { new: true });
    
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.status(200).json({ success: true, message: "Order status updated", order });
  } catch (error) {
    console.error("Error in updateOrderStatus:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Accept or reject order: /api/order/approval
export const updateOrderApproval = async (req, res) => {
  try {
    const { orderId, decision } = req.body;

    if (!["accepted", "rejected"].includes(decision)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid approval decision" });
    }

    const nextStatus =
      decision === "accepted" ? "Order Confirmed" : "Order Rejected";

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status: nextStatus },
      { new: true }
    )
      .populate("items.product userId");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const hydratedOrder = await hydrateOrderAddress(order);
    let customerEmail = hydratedOrder.address?.email || hydratedOrder.userId?.email;
    if (!customerEmail) {
      const user =
        typeof hydratedOrder.userId === "object"
          ? hydratedOrder.userId
          : await User.findById(hydratedOrder.userId).select("email name").lean();
      customerEmail = user?.email;
      hydratedOrder.userId = user || hydratedOrder.userId;
    }
    let emailSent = false;

    try {
      emailSent = await sendOrderDecisionEmail({
        to: customerEmail,
        order: hydratedOrder,
        decision,
      });
    } catch (emailError) {
      console.error("Order decision email failed:", emailError.message);
    }

    res.status(200).json({
      success: true,
      message: emailSent
        ? `Order ${decision} and email sent`
        : `Order ${decision}, but email was not sent. Check SMTP config.`,
      order: hydratedOrder,
      emailSent,
    });
  } catch (error) {
    console.error("Error in updateOrderApproval:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
