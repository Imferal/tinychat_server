const express = require('express')
const cors = require("cors");
const PORT = process.env.PORT ?? 9000
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// Подключаем JSON
app.use(express.json())

// Разрешаем все CORS-запросы
app.use(cors())

// Создаём коллекцию
const chatData = new Map();

// Обработка GET-запроса
app.get('/rooms/', (req, res) => {
  res.json('GET-запрос прошёл успешно!')
})

// Обработка POST-запроса при логине
app.post('/rooms', (req, res) => {
  const {roomId} = req.body;
  // Если комнаты не было - создаём новую коллекцию
  if (!chatData.has(roomId)) {
    chatData.set(
      roomId, new Map([
        ['users', new Map()],
        ['messages', []]
      ]),
    );
  }
  res.send();
})

// Работа с сокет-запросами
io.on('connection', (socket) => {
  // Пользователь присоединяется к комнате
  socket.on('JOIN', ({roomId, userName}) => {
    socket.join(roomId);
    chatData
      // Получаем комнату из формы логина
      .get(roomId)
      // Получаем коллекцию юзеров и добавляем туда нового юзера
      .get('users').set(socket.id, userName)
    // Получаем имена values() (а не ключи - keys())
    // всех пользователей и сообщений из комнаты
    const users = [...chatData.get(roomId).get('users').values()];
    const messages = [...chatData.get(roomId).get('messages').values()];
    // Оповещаем всех клиентов об изменении списка подключившихся
    io.in(roomId).emit('JOINED', ({users, messages}))
  })

  // Пользователь отправляет сообщение
  socket.on('NEW_MESSAGE', ({roomId, userName, text}) => {
    const newMessage = {
      userName,
      text,
    }
    // Добавляем сообщение в коллекцию
    chatData.get(roomId).get('messages').push(newMessage)
    // Обновляем список сообщений в комнате
    socket.to(roomId).emit('NEW_MESSAGE', newMessage)
  })

  // Удаляем пользователя
  socket.on('disconnect', () => {
    chatData.forEach((value, roomId) => {
      if (value.get('users').delete(socket.id)) {
        // Оповещаем всех пользователей
        const users = [...chatData.get(roomId).get('users').values()];
        socket.to(roomId).emit('SET_USERS', users)
      }
    })
  })
})

http.listen(PORT, (err) => {
  if (err) {
    throw Error(err)
  }
  console.log(`Server has been started on port ${PORT}...`)
})