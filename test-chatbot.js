import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const testChatbot = async () => {
    try {
        console.log("Testing chatbot endpoint...");
        const response = await axios.post('http://localhost:5000/api/chatbot', {
            message: "Hello"
        });
        console.log("Response:", response.data);
    } catch (error) {
        console.error("Error status:", error.response?.status);
        console.error("Error data:", error.response?.data);
    }
};

testChatbot();
