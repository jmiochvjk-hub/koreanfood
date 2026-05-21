# 韩国美食地图

静态地图应用，支持点击地图添加美食点。默认使用浏览器本地数据；填写 Supabase 配置后，所有访问者会共享同一份云端数据。

## 文件说明

- `index.html`：页面入口
- `styles.css`：界面样式
- `app.js`：地图、添加、删除、搜索和 Supabase 同步逻辑
- `config.example.js`：Supabase 配置模板
- `config.js`：本地配置文件，已被 `.gitignore` 忽略，不会提交到 GitHub
- `supabase-schema.sql`：Supabase 建表和公开读写策略

## 连接 Supabase

1. 在 Supabase 新建项目。
2. 打开 SQL Editor，执行 `supabase-schema.sql`。
3. 在 Project Settings > API 复制 Project URL 和 anon public key。
4. 复制配置模板：

```bash
cp config.example.js config.js
```

5. 编辑 `config.js`：

```js
window.SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};
```

刷新页面后，标题下方显示“云端同步已连接”即完成。

## 本地运行

```bash
python3 -m http.server 4173
```

然后打开 `http://127.0.0.1:4173/`。
