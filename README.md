# PulseDeck

一个暗色科技风的网页应用，用来持续追踪：

- 世界范围内正在发生的热点事件
- AI / NLP 领域的前沿论文、模型与研究成果

## 当前版本包含

- 双信息流首页：全球热点 + AI / NLP 前沿
- Python 后端 API
- 真实新闻源接入：GDELT News API
- 真实论文源接入：Semantic Scholar
- 浏览器通知权限申请
- 本地定时轮询与持续推送
- 今日摘要自动生成
- 本地设置保存（`localStorage`）
- PWA 基础支持（manifest + service worker）
- 网络异常时自动回退到本地后备数据

## 如何运行

现在这个版本不是纯静态页了，需要用自带的 Python 服务启动。

如果本机有 Python：

```bash
python3 server.py
```

然后访问：

```text
http://127.0.0.1:8000/index.html
```

## 部署到公网

这一版已经整理成可部署状态，最省事的方式是用 Render：

1. 把这个项目上传到 GitHub 仓库
2. 登录 Render，选择 `New +` -> `Blueprint`
3. 连接你的 GitHub 仓库
4. Render 会自动识别根目录里的 `render.yaml`
5. 部署完成后，你会拿到一个公开网址，任何人都能打开

当前项目已经包含：

- [render.yaml](/Users/didi/Documents/News/render.yaml)
- [requirements.txt](/Users/didi/Documents/News/requirements.txt)

部署后服务会读取平台注入的 `PORT`，并监听公网地址，不再只限于你本机。

## 重要说明

当前版本会优先连接真实新闻与真实论文数据源。如果网络受限、源站超时或接口异常，页面会自动切换到本地后备数据，不会出现空白页。

## 已接入的真实源

- 新闻：GDELT News API
- 研究：Semantic Scholar Academic Graph API

## 还没完成但建议作为下一步的部分

- 真正的后台持续推送：Web Push
- 浏览器关闭后继续送达：邮件、Telegram Bot、企业微信机器人
- 用户登录与多设备同步
- 更细的关键词订阅规则

## 下一步可做

1. 增加 Web Push 订阅
2. 增加邮件或 Telegram 的每日定时推送
3. 增加“只看你关注的话题”的高级过滤
4. 增加登录与个人订阅偏好
