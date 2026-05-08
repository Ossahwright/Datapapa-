import axios from 'axios';
async function test() {
  try {
    const res = await axios.post("http://localhost:3000/api/retry-vtu", { transactionId: "8a5715cb-bebe-46f4-9c21-032d9056199d" }, {
      headers: {
        "x-admin-bypass": "true" // simulate admin
      }
    });
    console.log("Success:", res.data);
  } catch (err: any) {
    if (err.response) {
      console.log("Status:", err.response.status);
      console.log("Data:", err.response.data);
    } else {
      console.log("Error:", err.message);
    }
  }
}
test();
