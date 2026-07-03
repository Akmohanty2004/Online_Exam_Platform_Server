const { Server } = require('socket.io');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Store connected users
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // User joins with their ID
    socket.on('user-join', (userId) => {
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      
      // Broadcast user joined
      socket.broadcast.emit('user-joined', {
        userId,
        socketId: socket.id
      });
    });

    // Join exam room
    socket.on('join-exam', (examId) => {
      socket.join(`exam-${examId}`);
      console.log(`User ${socket.userId} joined exam ${examId}`);
      
      // Notify others in the exam room
      io.to(`exam-${examId}`).emit('exam-joined', {
        userId: socket.userId,
        examId
      });
    });

    // Leave exam room
    socket.on('leave-exam', (examId) => {
      socket.leave(`exam-${examId}`);
      console.log(`User ${socket.userId} left exam ${examId}`);
      
      io.to(`exam-${examId}`).emit('exam-left', {
        userId: socket.userId,
        examId
      });
    });

    // Student started exam
    socket.on('exam-started', (data) => {
      const { examId, studentId } = data;
      io.to(`exam-${examId}`).emit('student-started', {
        studentId,
        examId,
        timestamp: new Date()
      });
    });

    // Student submitted exam
    socket.on('exam-submitted', (data) => {
      const { examId, studentId } = data;
      io.to(`exam-${examId}`).emit('student-submitted', {
        studentId,
        examId,
        timestamp: new Date()
      });
    });

    // Real-time progress update
    socket.on('progress-update', (data) => {
      const { examId, studentId, progress } = data;
      io.to(`exam-${examId}`).emit('student-progress', {
        studentId,
        progress,
        timestamp: new Date()
      });
    });

    // Admin notifications
    socket.on('admin-join', () => {
      socket.join('admin-room');
    });

    // Teacher notifications
    socket.on('teacher-join', (teacherId) => {
      socket.join(`teacher-${teacherId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      if (socket.userId) {
        connectedUsers.delete(socket.userId);
        socket.broadcast.emit('user-left', {
          userId: socket.userId
        });
      }
    });
  });

  return io;
};

// Helper functions to emit events
const emitToUser = (userId, event, data) => {
  const socketId = connectedUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

const emitToExam = (examId, event, data) => {
  io.to(`exam-${examId}`).emit(event, data);
};

const emitToAdmin = (event, data) => {
  io.to('admin-room').emit(event, data);
};

const emitToTeacher = (teacherId, event, data) => {
  io.to(`teacher-${teacherId}`).emit(event, data);
};

module.exports = {
  initializeSocket,
  emitToUser,
  emitToExam,
  emitToAdmin,
  emitToTeacher,
  getIO: () => io
};