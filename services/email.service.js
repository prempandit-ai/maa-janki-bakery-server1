import nodemailer from "nodemailer";

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (
    !host ||
    !user ||
    !pass ||
    user.includes("your_") ||
    pass.includes("your_")
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
    auth: { user, pass },
  });
};

const withTimeout = (promise, timeoutMs, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), timeoutMs)
    ),
  ]);

export const sendOrderDecisionEmail = async ({ to, order, decision }) => {
  const transporter = getTransporter();

  if (!transporter || !to) {
    console.warn("Order email skipped: SMTP config or recipient email is missing");
    return false;
  }

  const isAccepted = decision === "accepted";
  const subject = isAccepted
    ? "Your Maa Janki Bakery order is confirmed"
    : "Your Maa Janki Bakery order was rejected";
  const statusText = isAccepted ? "Order Confirmed" : "Order Rejected";
  const items = (order.items || [])
    .map((item) => `${item.product?.name || "Product"} x ${item.quantity}`)
    .join(", ");

  await withTimeout(
    transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: [
        `Hello ${order.address?.firstName || order.userId?.name || "Customer"},`,
        "",
        isAccepted
          ? "Your order has been accepted by Maa Janki Bakery & Farsan Store."
          : "Sorry, your order has been rejected by Maa Janki Bakery & Farsan Store.",
        "",
        `Order ID: ${order._id}`,
        `Status: ${statusText}`,
        `Items: ${items || "N/A"}`,
        `Total: Rs. ${order.amount}`,
        "",
        "Thank you.",
      ].join("\n"),
    }),
    9000,
    "Email send timed out"
  );

  return true;
};
