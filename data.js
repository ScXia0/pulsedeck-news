export const worldHotTopics = [
  {
    title: "全球主要资本市场关注央行政策窗口",
    summary:
      "市场焦点集中在主要经济体的通胀路径与降息预期，风险资产对政策表态保持高敏感度。",
    region: "Global Macro",
    signal: "后备数据",
    relevance: "资金流向、汇率与成长股估值",
  },
  {
    title: "中东与红海航运风险仍在牵动能源与物流",
    summary:
      "地缘摩擦对航运成本和原油价格形成扰动，全球供应链稳定性仍是国际观察重点。",
    region: "Middle East",
    signal: "后备数据",
    relevance: "能源价格、运费与供应链韧性",
  },
  {
    title: "全球 AI 基础设施竞争推动算力投资加速",
    summary:
      "云厂商与芯片生态继续扩大资本开支，AI 相关硬件、数据中心和能源配套进入高景气区间。",
    region: "Tech",
    signal: "后备数据",
    relevance: "算力、芯片、云服务与电力建设",
  },
  {
    title: "多国针对平台治理与数据合规持续出台新动作",
    summary:
      "围绕生成式 AI、隐私与平台责任的监管逐步细化，企业需要持续调整模型与数据策略。",
    region: "Policy",
    signal: "后备数据",
    relevance: "合规成本、产品设计与跨境数据流",
  },
  {
    title: "全球创业投资回暖信号集中在 AI 与高效软件领域",
    summary:
      "资金更偏向具备明确收入模型的 AI 应用和基础设施公司，融资逻辑从故事驱动转向效率驱动。",
    region: "Venture",
    signal: "后备数据",
    relevance: "创业公司融资窗口与赛道判断",
  },
];

export const researchHotTopics = [
  {
    title: "多智能体工作流从 demo 转向可控生产化",
    summary:
      "近期研究重点放在工具调用稳定性、记忆管理和错误恢复，让 agent 从单次问答走向任务闭环。",
    domain: "Agents",
    signal: "后备数据",
    relevance: "工作流自动化、企业 Copilot、复杂任务分解",
  },
  {
    title: "长上下文模型继续探索检索与压缩协同",
    summary:
      "研究趋势从单纯扩大上下文窗口，转向记忆压缩、检索增强和结构化状态管理的组合优化。",
    domain: "LLM Systems",
    signal: "后备数据",
    relevance: "知识助手、代码理解、长文档分析",
  },
  {
    title: "小模型蒸馏与高效推理成为落地关键",
    summary:
      "越来越多成果聚焦如何让更小模型保留任务能力，同时在端侧和低成本场景中保持可部署性。",
    domain: "Efficient AI",
    signal: "后备数据",
    relevance: "移动端部署、私有化模型、成本优化",
  },
  {
    title: "多模态理解正在与语言推理深度融合",
    summary:
      "视觉、语音和文本的协同推理能力增强，研究重点开始进入更复杂的跨模态规划与交互任务。",
    domain: "Multimodal",
    signal: "后备数据",
    relevance: "智能助手、机器人、人机交互",
  },
  {
    title: "NLP 评测开始强调真实任务与稳定性指标",
    summary:
      "基准测试不再只看单点分数，鲁棒性、可解释性和任务完成率被放到更重要的位置。",
    domain: "Evaluation",
    signal: "后备数据",
    relevance: "模型选型、线上监控、质量基准",
  },
];

export const musicHotTracks = [
  {
    title: "Ordinary",
    artist: "Alex Warren",
    summary: "流媒体与短视频平台热度持续走高，适合作为近期开屏热歌观察样本。",
    genre: "Pop",
    signal: "后备数据",
    relevance: "高频播放、短视频扩散、榜单稳定上行",
  },
  {
    title: "Die With A Smile",
    artist: "Lady Gaga & Bruno Mars",
    summary: "跨圈层传播力很强，兼具主流榜单表现与视频平台二次创作热度。",
    genre: "Pop",
    signal: "后备数据",
    relevance: "主流热单、合唱话题、全球流量",
  },
  {
    title: "APT.",
    artist: "ROSÉ & Bruno Mars",
    summary: "兼具国际流量与亚洲讨论度，适合放在热歌流里做高活跃条目。",
    genre: "Global Pop",
    signal: "后备数据",
    relevance: "全球传播、短视频扩散、跨区热度",
  },
  {
    title: "Beautiful Things",
    artist: "Benson Boone",
    summary: "情绪表达强，常见于热门歌单和翻唱二创，长尾热度表现稳。",
    genre: "Pop Rock",
    signal: "后备数据",
    relevance: "翻唱扩散、歌单常驻、长尾播放",
  },
  {
    title: "Lose Control",
    artist: "Teddy Swims",
    summary: "在电台、流媒体和现场表演内容里都保持很高存在感。",
    genre: "Soul Pop",
    signal: "后备数据",
    relevance: "电台扩散、流媒体稳定、现场传播",
  },
  {
    title: "Birds of a Feather",
    artist: "Billie Eilish",
    summary: "兼具主流听众和审美型受众关注度，适合作为近期热歌池的重要补位。",
    genre: "Alt Pop",
    signal: "后备数据",
    relevance: "审美传播、歌单渗透、全球听众",
  },
];

export function buildDigest(worldItems, researchItems, musicItems, keywords) {
  const world = worldItems[0];
  const research = researchItems[0];
  const music = musicItems[0];
  const secondWorld = worldItems[1];
  const secondResearch = researchItems[1];
  const secondMusic = musicItems[1];

  return [
    "今日情报简报",
    "",
    `1. 全球热点重点: ${world?.title || "暂无"}`,
    `摘要: ${world?.summary || "暂无摘要"}`,
    `补充线索: ${secondWorld?.title || "暂无补充线索"}`,
    `影响面: ${world?.relevance || "待补充"}`,
    "",
    `2. AI / NLP 重点: ${research?.title || "暂无"}`,
    `摘要: ${research?.summary || "暂无摘要"}`,
    `补充线索: ${secondResearch?.title || "暂无补充线索"}`,
    `落地方向: ${research?.relevance || "待补充"}`,
    "",
    `3. 热门歌曲重点: ${music?.title || "暂无"}${music?.relevance ? ` · ${music.relevance}` : ""}`,
    `摘要: ${music?.summary || "暂无摘要"}`,
    `补充线索: ${secondMusic?.title || "暂无补充线索"}`,
    `热度线索: ${music?.signal || "待补充"}`,
    "",
    `4. 当前追踪关键词: ${keywords || "未设置"}`,
    "",
    "注: 当前版本已经优先连接真实新闻源、真实论文源和音乐榜单源；如果网络或源站异常，会自动回退到本地后备数据，确保页面始终可用。",
  ].join("\n");
}
