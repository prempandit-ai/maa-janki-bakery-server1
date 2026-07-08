import Address from "../models/address.model.js";
// add address :/api/address/add
export const addAddress = async (req, res) => {
  try {
    const { address } = req.body;
    const userId = req.user;

    if (!userId) {
      return res.status(401).json({ message: "Please login to add an address", success: false });
    }

    if (!address || typeof address !== "object") {
      return res.status(400).json({ message: "Address details are required", success: false });
    }

    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "street",
      "city",
      "state",
      "zipCode",
      "country",
      "phone",
    ];
    const missingField = requiredFields.find((field) => !String(address[field] ?? "").trim());

    if (missingField) {
      return res.status(400).json({
        message: `${missingField} is required`,
        success: false,
      });
    }

    await Address.create({
      ...address,
      userId: userId,
    });
    res
      .status(201)
      .json({ success: true, message: "Address added successfully" });
  } catch (error) {
    console.error("Add address error:", error.message);
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

//get address:// /api/address/get
export const getAddress = async (req, res) => {
  try {
    const userId = req.user;
    const addresses = await Address.find({ userId });
    res.status(200).json({ success: true, addresses });
  } catch (error) {
    console.error("Get address error:", error.message);
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};
