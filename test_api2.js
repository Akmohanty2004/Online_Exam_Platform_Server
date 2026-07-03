const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const student = await mongoose.connection.db.collection('users').findOne({ role: 'student' });
    const token = jwt.sign(
      { id: student._id, role: student.role },
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '1h' }
    );
    
    console.log(`Testing with student: ${student.email}`);
    
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/exams/6a440c32afe214e01b0f63e7/student',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log("Status:", res.statusCode);
        const parsed = JSON.parse(data);
        if(parsed.questions) {
            console.log(`Questions returned: ${parsed.questions.length}`);
            console.log(`First question: ${parsed.questions[0]?.question}`);
        } else {
            console.log("No questions array found in response!");
            console.log(parsed);
        }
        process.exit(0);
      });
    });

    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      process.exit(1);
    });

    req.end();
    
  } catch (error) {
    console.error("Setup Error:", error.message);
    process.exit(1);
  }
});
