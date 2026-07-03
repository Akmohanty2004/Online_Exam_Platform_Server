const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'c:/Users/ashis/OneDrive/Desktop/project/online-exam-platform/server/.env' });
const http = require('http');

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const exams = await mongoose.connection.db.collection('exams').find({ title: 'dgdfbg' }).toArray();
    if (exams.length > 0) {
      const examId = exams[0]._id;
      const teacherId = exams[0].createdBy;
      
      const token = jwt.sign({ id: teacherId.toString(), role: 'teacher' }, process.env.JWT_SECRET || 'your-secret-key');
      
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: `/api/results/exam/${examId}`,
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
    }
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
});
