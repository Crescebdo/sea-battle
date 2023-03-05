const MIN_PLAYER_NUM = 1;
const MAX_PLAYER_NUM = 8;
const MAX_NOGO_NUM = 8;
const GAME_START_FISH_NUM = { min: 4, max: 6 };
const SHIP_SETTING = [
  {
    name: "草船",
    health: 1,
    width: 1,
    height: 1,
    cannon: 1,
    torpedo: 1,
    aircraft: 0,
    speed: 4,
    skills: [
      {
        skillName: "闪避",
        description:
          '<span class="hi">每场游戏限一次</span>，被攻击后，若未抵挡，可以消耗50节操，闪避本回合所有攻击。',
      },
    ],
    passive: "被冰雹击中的概率为25%。",
    note: "机动性强体积又小作为优点，想要命中需要很强的技巧。武装后的艹船毫无破绽，与它战斗的话你最好多留个神。",
    quote: "“我觉得草船最好肿么破？”——久久",
  },
  {
    name: "潜水艇",
    health: 2,
    width: 1,
    height: 2,
    cannon: 0,
    torpedo: 3,
    aircraft: 0,
    speed: 2,
    skills: [
      {
        skillName: "下潜",
        description: "被攻击后，不通报击中，然后可以移动1次。",
      },
    ],
    passive: "无视冻结、冰雹天气。",
    note: "潜水艇违背常理，专注使用不会受到天气眷顾的鱼雷，却换来了水下行动的特权。这一刻它从你的视线中消失，下一刻你从地图上消失。",
    quote: "“开始怎么怎么也侦查到但是就是炸不到疼死我了。”——精杯",
  },
  {
    name: "回收舰",
    health: 2,
    width: 1,
    height: 2,
    cannon: 2,
    torpedo: 0,
    aircraft: 0,
    speed: 1,
    skills: [
      {
        skillName: "回收",
        description:
          "击毁距离2内的船只后，回复1血并通报。击毁杂鱼或船只后，额外获得50节操。",
      },
      {
        skillName: "鄙视",
        description:
          '<span class="hi">每回合限一次</span>，可消耗50节操，获知节操数最高的其它船只所处方向。',
      },
    ],
    note: "为打造完美战舰的失败品之一，它最终仅仅成为了受人瞧不起的回收舰。实际上它拥有坚固的机甲和方便搭载武器的平台，无论是什么样的战斗都无法重创回收舰。+1s。",
    quote: "“回收舰是个毛线玩意啊？！”——柠檬",
  },
  {
    name: "水雷舰",
    health: 2,
    width: 1,
    height: 2,
    cannon: 1,
    torpedo: 1,
    aircraft: 0,
    speed: 2,
    skills: [
      {
        skillName: "标准水雷",
        description:
          '<span class="hi">每个普通回合限一次</span>，若未使用主炮，可在当前坐标放置一个标准水雷<small>（离开后起效）</small>，然后本回合你不可使用主炮。',
      },
      {
        skillName: "梅花水雷",
        description:
          '<span class="hi">每个普通回合限一次</span>，若未使用主炮，可消耗50节操，在任意非禁区坐标放置一个梅花水雷<small>（若与自身重叠，离开后起效）</small>，然后本回合你不可使用主炮。',
      },
    ],
    note: "水中的针对舰艇或潜艇的爆炸装置，受到冲击时会自动引爆。难以清除且方便制造，在进攻与防守方面都十分的优秀。",
    quote: "“巡航舰太强了，我们来增强一下水雷吧。”-ND",
  },
  {
    name: "菊花箭船",
    health: 3,
    width: 1,
    height: 2,
    cannon: 2,
    torpedo: 0,
    aircraft: 0,
    speed: 1,
    skills: [
      {
        skillName: "暴击",
        description:
          "发射主炮时，可令伤害+1。若如此做，回合结束后，通报你发动“暴击”时的坐标。",
      },
    ],
    note: "不计后果地，将全部的怨恨集中于最强的菊花箭上，一般船只根本无法承受这一击。在一切结束后，挥一挥手，深藏功与名。",
    quote: "“HK的小雏菊势不可挡！”——二僵",
  },
  {
    name: "破冰船",
    health: 3,
    width: 1,
    height: 3,
    cannon: 1,
    torpedo: 0,
    aircraft: 0,
    speed: 3,
    skills: [
      {
        skillName: "体术",
        description:
          '<span class="hi">攻击额外回合不可用。每回合限一次</span><small>（冰雹与冻结天气改为限两次）</small>，可对与你重叠的其它船只与杂鱼各造成1点伤害。对同一艘船至多依此法造成1点伤害。',
      },
    ],
    passive: "无视冻结天气。",
    note: "受到诅咒一般的船只，企图和它接近的物体都会被惨无人道的撕裂。既然身怀不幸的命运，干脆一起结束这场战争吧。",
  },
  {
    name: "幽灵船",
    health: 3,
    width: 1,
    height: 3,
    cannon: 2,
    torpedo: 0,
    aircraft: 0,
    speed: Infinity,
    skills: [
      {
        skillName: "化身",
        description:
          "被攻击后，你选择任意一个船种作为通报对象。若选择“潜水艇”，不通报击中；若选择“幽灵船”，额外获得50节操；若选择其它船种，额外获得25节操。",
      },
      {
        skillName: "诅咒",
        description:
          '<span class="hi">每场游戏限一次</span>，被攻击后，可诅咒发动攻击的玩家。若如此做，下一轮开始时，通报该玩家被诅咒，天气改为浓雾，然后此轮所有特性与物品无效。',
      },
    ],
    passive: "无视冻结天气。",
    note: "数据删除。",
    quote: "“我就喜欢用叒的，用叒的淦JB的破冰。”——-7",
  },
  {
    name: "炮船",
    health: 4,
    width: 2,
    height: 2,
    cannon: 1,
    torpedo: 0,
    aircraft: 0,
    speed: 1,
    skills: [
      {
        skillName: "反击",
        description:
          '<span class="hi">每个普通回合限一次</span>，被攻击后，你获知伤害来源所处方向，然后在本回合结束后，执行一个攻击额外回合。',
      },
      {
        skillName: "借炮杀人",
        description:
          "可将“反击”效果改为令一名其他玩家执行一个攻击额外回合。若如此做，你闪避该回合该玩家对你的攻击，且其获得的所有节操转移至你。",
      },
    ],
    note: "碉堡一般的存在，装备了完美的装甲。在如此强大的火力和装甲下，让人期待到底谁会胆敢与炮船作对。其实是俄国脑洞太大制造的战舰……",
  },
  {
    name: "轻型航母",
    health: 2,
    width: 1,
    height: 2,
    cannon: 0,
    torpedo: 0,
    aircraft: 3,
    speed: 2,
    skills: [
      {
        skillName: "反潜",
        description: "击中潜水艇时，私密获知。",
      },
      {
        skillName: "交叉投弹",
        description:
          '<span class="hi">移动额外回合不可用</span>。回合中，可消耗3架飞机，进行一次附加雷雨弹或辣椒弹效果的攻击。',
      },
    ],
    note: "航空母舰的缩水版！虽然搭载和<del>胸部</del>都很小，但是体积和航速都是很优秀的！",
  },
  {
    name: "冰航母",
    health: 4,
    width: 1,
    height: 4,
    cannon: 0,
    torpedo: 0,
    aircraft: 5,
    speed: 0,
    skills: [
      {
        skillName: "补充",
        description:
          '<span class="hi">每个普通回合限一次</span>，若自动补充飞机后搭载量未满，可消耗25X节操，增加X架飞机。',
      },
      {
        skillName: "丢冰块",
        description:
          '<span class="hi">每场游戏限一次</span>，普通回合中，可减少1格体积并失去1血，令本回合你的攻击附带眩晕效果。被眩晕的船只无法进行任何操作，直到其下一个普通回合结束。',
      },
    ],
    note: "逗比与耍宝的境界。被冰航母所击毁的船只，将背负着永世都无法忘记的苦难和屈辱。",
    quote: "“航空母舰这下牛逼了，增加了轰炸机和侦察机。”——HK",
  },
];
const WEATHER = [
  {
    name: "浓雾",
    description: "攻击与侦察距离为1。",
  },
  {
    name: "雷雨",
    description: "主炮的攻击范围为3&times;3（发动“暴击”时除外）。",
  },
  {
    name: "晴天",
    description: "飞机攻击范围为一列或一行。",
  },
  {
    name: "暴雨",
    description: "每只船的主炮与飞机最多各使用1次，并且航速-1。",
  },
  {
    name: "顺风",
    description: "所有船只航速+1。",
  },
  {
    name: "赤潮",
    description: "生成2~3只杂鱼。",
  },
  {
    name: "星夜",
    description: "所有玩家节操+50。",
  },
  {
    name: "寒潮",
    description: "下轮天气为冰雹，冻结或白雪。",
  },
  {
    name: "冰雹",
    description:
      "本轮结束时，草船有25%概率受到1点伤害，其它船只有33%概率受到1点伤害（对潜水艇无效）。",
  },
  {
    name: "冻结",
    description: "船只无法移动（对潜水艇、破冰船、幽灵船无效）。",
  },
  {
    name: "白雪",
    description: "所有特性与物品无效。",
  },
  {
    name: "极光",
    description: "所有船只回复1血。",
  },
  {
    name: "满月",
    description:
      "所有船只航速无限。所有船只增加1次攻击和特性发动次数。所有攻击方式伤害+1。所有船只回复1血。",
  },
];
const WEATHER_WEIGHT_NORMAL = [
  61 / 11,
  61 / 11,
  61 / 11,
  61 / 11,
  61 / 11,
  61 / 11,
  61 / 11,
  61 / 11,
  61 / 11,
  61 / 11,
  61 / 11,
  2,
  1,
];
const WEATHER_WEIGHT_COLD = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0];
const SHORT_WAIT_TIME = 10; // in seconds
const SHOP_TIME = 20;
const TURN_TIME = 10;
const INFO_TIME = 8;

module.exports = {
  MIN_PLAYER_NUM,
  MAX_PLAYER_NUM,
  MAX_NOGO_NUM,
  GAME_START_FISH_NUM,
  SHIP_SETTING,
  WEATHER,
  WEATHER_WEIGHT_NORMAL,
  WEATHER_WEIGHT_COLD,
  SHORT_WAIT_TIME,
  SHOP_TIME,
  TURN_TIME,
  INFO_TIME,
};
