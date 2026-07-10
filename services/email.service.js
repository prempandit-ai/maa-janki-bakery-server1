import nodemailer from "nodemailer";
import dns from "dns";

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  if (
    !host ||
    !Number.isInteger(port) ||
    !user ||
    !pass ||
    user.includes("your_") ||
    pass.includes("your_")
  ) {
    return null;
  }

  return { host, port, user, pass };
};

const getTransporter = () => {
  const config = getSmtpConfig();

  if (!config) {
    return null;
  }

  const { host, port, user, pass } = config;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
    // Force IPv4 resolution. Render (and similar cloud hosts) often prefer
    // IPv6 by default, but Gmail's SMTP servers can be unreliable or
    // unreachable over IPv6 from these networks, causing the connection to
    // hang until it hits connectionTimeout ("Connection timeout" in logs).
    // Forcing family: 4 here makes Nodemailer resolve smtp.gmail.com to an
    // IPv4 address instead, which resolves this on Render specifically.
    lookup: (hostname, options, callback) =>
      dns.lookup(hostname, { family: 4 }, callback),
    tls: {
      servername: host,
    },
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
    console.warn(
      "Order email skipped:",
      !transporter ? "SMTP config is missing or invalid" : "recipient email is missing"
    );
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

  const info = await withTimeout(
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

  console.log("Order decision email sent:", {
    to,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  });

  return true;
};
