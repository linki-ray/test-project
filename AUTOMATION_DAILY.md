# 每日内容参谋 · 自动化更新指南（免开机）

## 目标
每天定时由 WorkBuddy 自动化任务生成「今日行动建议 / 爆款雷达 / 拍摄脚本」，写入
`assets/data/daily-data.js` 并推送，Cloudflare 自动重建。你**无需开电脑**，手机浏览器
打开 https://test-project-ek2.pages.dev → 今日参谋，即是当天最新内容。

## 前置条件（一次性）
1. 在 WorkBuddy 自动化设置里，把 **GitHub Personal Access Token**（需 `repo` 权限，
   能读写 `linki-ray/test-project`）配置到任务可用的 secrets / 环境变量（如 `GH_TOKEN`）。
2. 仓库已关联 Cloudflare Pages（已有，push 即重建）。

## 数据流
定时触发 → 采集公开爆款(WebSearch/fetch) → AI 生成 `__DAILY__` → 写 daily-data.js →
GitHub API 推送 → Cloudflare 重建 → 手机刷新即新

## 自动化 Prompt 模板（直接粘贴到自动化创建框）
---
每天 08:00（rrule: FREQ=DAILY;BYHOUR=8）执行：

你是「奶黄 + 橘猫布丁」猫咪抖音/小红书账号的内容参谋（账号名历史遗留"狗子叫帅帅"，
实际已无狗，只有两只猫）。请完成以下每日更新：

1. 采集：用 WebSearch 搜索「猫咪 抖音 爆款」「橘猫 萌宠 热门」等，找 3-5 条近期公开
   爆款笔记/视频（也可用用户提供的爆款链接池）。读取现有
   https://test-project-ek2.pages.dev/assets/data/daily-data.js 作为历史参考。
2. 生成：产出一份今日内容方案，包含：
   - greeting：结合当天日期/节气的一句情绪文案
   - advice：今日最值得发的一条（title + 3 条理由 + 建议发布时间 + 平台）
   - hot：3 条爆款雷达（tag + note + 可拍角度）
   - script：1 条拍摄脚本（title + 黄金3秒 + beats 分镜 + 标签 + BGM）
   内容必须围绕两只猫（奶黄、橘猫布丁），双猫互动优先。
3. 写入：把方案组装成如下 JS 并写回仓库文件
   `assets/data/daily-data.js`（内容：`window.__DAILY__ = {...};`），
   其中 date 为当天，updatedAt 为当前时间（ISO，含时区）。
4. 推送：用配置的 GH_TOKEN，通过 GitHub Contents API 更新该文件并提交到 main：
   - 先 GET
     https://api.github.com/repos/linki-ray/test-project/contents/assets/data/daily-data.js
     取 sha 与 base64 旧内容
   - 再 PUT 同样路径，body：
     {"message":"daily update <日期>","sha":"<上一步sha>",
      "content":"<新文件内容的 base64>","branch":"main"}
   认证头：Authorization: Bearer <GH_TOKEN>
5. 完成后简报：告知更新了哪些内容、发布时间建议。

注意：不要改动其他文件；若 GitHub API 不可用，改为生成本地文件并提示用户手动 push。
---

## GitHub API 速查（若自动化支持执行命令）
```bash
# 1) 取当前文件的 sha
curl -s -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/linki-ray/test-project/contents/assets/data/daily-data.js
# 返回 JSON 里取 .sha 与 .content（旧内容 base64）

# 2) 把新内容 base64 编码
NEW=$(base64 -w0 assets/data/daily-data.js)

# 3) 推送更新
curl -s -X PUT -H "Authorization: Bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/linki-ray/test-project/contents/assets/data/daily-data.js \
  -d "{\"message\":\"daily update\",\"sha\":\"<SHA>\",\"content\":\"$NEW\",\"branch\":\"main\"}"
```

## 验证
push 后访问 https://test-project-ek2.pages.dev → 今日参谋，看 updatedAt 是否为当天、
内容是否已刷新。强制刷新（Ctrl/Cmd+Shift+R）清缓存。
