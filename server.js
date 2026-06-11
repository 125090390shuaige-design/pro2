const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// 1. 全局内存数组，存放所有 todo 项
let todos = [];
let nextId = 1; // id 自增计数器

// 2. 配置 express.json() 中间件，解析 POST/PUT 请求体
app.use(express.json());

// CORS 跨域支持（允许前端从任何来源访问 API）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 托管前端静态文件（index.html 在 server.js 同目录）
app.use(express.static(path.join(__dirname)));

// ========== 3. 4个 API 接口 ==========

// ① GET /todos — 查询全部 todo 列表
app.get('/todos', (req, res) => {
  res.json({ code: 200, data: todos });
});

// ② POST /todos — 新增 todo
app.post('/todos', (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ code: 400, message: 'title 不能为空' });
  }

  const todo = {
    id: nextId++,
    title,
    completed: false,
  };

  todos.push(todo);
  res.status(201).json({ code: 201, message: '创建成功', data: todo });
});

// ③ PUT /todos/:id — 根据 id 切换 todo 完成状态
app.put('/todos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const todo = todos.find(t => t.id === id);

  if (!todo) {
    return res.status(404).json({ code: 404, message: `id 为 ${id} 的 todo 不存在` });
  }

  todo.completed = !todo.completed;
  res.json({ code: 200, message: '更新成功', data: todo });
});

// ④ DELETE /todos/:id — 根据 id 删除 todo
app.delete('/todos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = todos.findIndex(t => t.id === id);

  if (index === -1) {
    return res.status(404).json({ code: 404, message: `id 为 ${id} 的 todo 不存在` });
  }

  const deleted = todos.splice(index, 1)[0];
  res.json({ code: 200, message: '删除成功', data: deleted });
});

// 4. 启动服务
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
