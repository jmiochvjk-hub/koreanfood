# 韩国美食地图

静态地图应用，支持点击地图添加美食点。默认使用浏览器本地数据；填写 Supabase 配置后，所有访问者会共享同一份云端数据。

## 文件说明

- `index.html`：页面入口
- `styles.css`：界面样式
- `app.js`：地图、添加、删除、搜索和 Supabase 同步逻辑
- `config.js`：Supabase 配置，**会提交到仓库**（见下方安全说明）
- `config.example.js`：模板，方便初始化或参考
- `supabase-schema.sql`：Supabase 建表和公开读写策略

## 连接 Supabase

1. 在 Supabase 新建项目。
2. 打开 SQL Editor，执行 `supabase-schema.sql`。
3. 在 Project Settings > API 复制 Project URL 和 anon public key。
4. 编辑 `config.js`：

```js
window.SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};
```

5. 提交并推送：

```bash
git add config.js
git commit -m "Configure Supabase"
git push
```

刷新页面后，标题下方显示"云端同步已连接"即完成。

## 关于 anon key 的安全性

Supabase 的 **anon key 是设计成公开的**——它本来就要在浏览器里执行，任何访问者打开 DevTools 都能看到。真正的安全边界是 `supabase-schema.sql` 里的 Row Level Security (RLS) 策略，它决定 anon 角色能读/写/删什么数据。

所以把 `config.js` 提交到公开仓库是 Supabase 官方推荐的做法。

**千万不要** 把 `service_role` key 写进 `config.js`，那个是后端用的、有完全管理员权限的 key。

## 本地运行

```bash
python3 -m http.server 4173
```

然后打开 `http://127.0.0.1:4173/`。

## 部署

直接走 GitHub Pages：仓库 Settings > Pages > Source 选 `Deploy from a branch`，Branch 选 `main` / `/ (root)`，保存即可。
