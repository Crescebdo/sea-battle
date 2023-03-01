const MIN_PLAYER_NUM = 1;
const MAX_PLAYER_NUM = 8;
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
          "每场游戏限一次，被攻击后，可以消耗50节操，闪避本回合所有攻击。",
      },
    ],
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
          "每回合限一次，可消耗50节操，获知节操数最高的其它船只所处方向。",
      },
    ],
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
          "每个普通回合限一次，若未使用主炮，可在当前坐标放置一个标准水雷（离开后起效），然后本回合你不可使用主炮。",
      },
      {
        skillName: "梅花水雷",
        description:
          "每个普通回合限一次，若未使用主炮，可消耗50节操，在任意非禁区坐标放置一个梅花水雷（若与自身重叠，离开后起效），然后本回合你不可使用主炮。",
      },
    ],
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
          "攻击额外回合不可用。每回合限一次（冰雹和冻结天气改为限两次），可对与你重叠的其它船只与杂鱼各造成1点伤害。对同一艘船至多依此法造成1点伤害。",
      },
    ],
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
          "被攻击后，须选择任意一个船种作为通报对象。若选择“潜水艇”，不通报击中；若选择“幽灵船”，额外获得50节操；若选择其它船种，额外获得25节操。",
      },
      {
        skillName: "诅咒",
        description:
          "每场游戏限一次，被攻击后，可诅咒发动攻击的玩家。若如此做，下一轮开始时，通报该玩家被诅咒，天气改为浓雾，然后此轮所有特性和物品无效。",
      },
    ],
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
          "每个普通回合限一次，被攻击后，可获知伤害来源所处方向，然后在本回合结束后，执行一个攻击额外回合。",
      },
      {
        skillName: "借炮杀人",
        description:
          "可将“反击”效果改为令一名其他玩家执行一个攻击额外回合。若如此做，该攻击回合内该玩家对你造成的伤害无效，且其获得的所有节操转移至你。",
      },
    ],
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
          "移动额外回合不可用。回合中，可消耗3架飞机，进行一次附加雷雨弹或辣椒弹效果的攻击。",
      },
    ],
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
          "每个普通回合限一次，若自动补充飞机后搭载量未满，可消耗25*X节操，增加X架飞机。",
      },
      {
        skillName: "丢冰块",
        description:
          "每场游戏限一次，普通回合中，可减少1格体积并对自己造成1点伤害，令本回合你的攻击附带眩晕效果。被眩晕的船只无法进行任何操作，直到其下一个普通回合结束。",
      },
    ],
  },
];

module.exports = {
  MIN_PLAYER_NUM,
  MAX_PLAYER_NUM,
  SHIP_SETTING,
};
