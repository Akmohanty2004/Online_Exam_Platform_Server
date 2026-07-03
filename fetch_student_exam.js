const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'c:/Users/ashis/OneDrive/Desktop/project/online-exam-platform/server/.env' });
const http = require('http');

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const examId = "6a4405761ed36cc8fc2c0f7b";
    
    // Find a student
    const student = await mongoose.connection.db.collection('users').findOne({ role: 'student' });
    if (!student) {
      console.log('No student found');
      process.exit(1);
    }
    
    const token = jwt.sign({ id: student._id.toString(), role: 'student' }, process.env.JWT_SECRET || 'your-secret-key');
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api/exams/${examId}/student`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
        process.exit(0);
      });
    });

    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      process.exit(1);
    });
    req.end();
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
});
