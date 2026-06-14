const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const JWT_SECRET = 'todo-app-secret-key-2025';

// ===== 初始化数据库 =====
const db = new Database('todos.db');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ===== 中间件 =====
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.static(path.join(__dirname)));

// ===== 鉴权中间件 =====
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ code: 401, message: '未登录' });

  try {
    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }
}

// ===== 注册 =====
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }
  if (username.length < 2) {
    return res.status(400).json({ code: 400, message: '用户名至少2个字符' });
  }
  if (password.length < 4) {
    return res.status(400).json({ code: 400, message: '密码至少4个字符' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ code: 400, message: '用户名已被注册' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashed);
  const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({ code: 201, message: '注册成功', token });
});

// ===== 登录 =====
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ code: 200, message: '登录成功', token, username: user.username });
});

// ===== Todo CRUD（全部需要登录） =====

// 获取列表
app.get('/todos', authMiddleware, (req, res) => {
  const todos = db.prepare('SELECT id, title, completed FROM todos WHERE user_id = ?').all(req.userId);
  res.json({ code: 200, data: todos.map(t => ({ ...t, completed: !!t.completed })) });
});

// 新增
app.post('/todos', authMiddleware, (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ code: 400, message: '内容不能为空' });

  const result = db.prepare('INSERT INTO todos (user_id, title) VALUES (?, ?)').run(req.userId, title);
  const todo = db.prepare('SELECT id, title, completed FROM todos WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ code: 201, message: '创建成功', data: { ...todo, completed: !!todo.completed } });
});

// 切换完成状态
app.put('/todos/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!todo) return res.status(404).json({ code: 404, message: '任务不存在' });

  db.prepare('UPDATE todos SET completed = ? WHERE id = ?').run(todo.completed ? 0 : 1, id);
  const updated = db.prepare('SELECT id, title, completed FROM todos WHERE id = ?').get(id);
  res.json({ code: 200, message: '更新成功', data: { ...updated, completed: !!updated.completed } });
});

// 删除
app.delete('/todos/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!todo) return res.status(404).json({ code: 404, message: '任务不存在' });

  db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  res.json({ code: 200, message: '删除成功' });
});

// ===== 启动 =====
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
