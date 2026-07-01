import User from "../models/user.model.js";

// update user cartData: /api/cart/update

export const updateCart = async (req, res) => {
  try {
    const userId = req.user;
    const { cartItems } = req.body;

    if (!cartItems || typeof cartItems !== "object") {
      return res
        .status(400)
        .json({ message: "Invalid cart data", success: false });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { cartItems },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    res.status(200).json({ success: true, message: "Cart updated" });
  } catch (error) {
    console.error("Cart update error:", error.message);
    res.status(500).json({ message: "Server error", success: false });
  }
};
