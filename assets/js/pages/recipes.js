/* ============================================================
   今日菜谱 —— 分类浏览 / 今日吃什么转盘 / 一键做菜指南 / 导入菜单
   - 二级类目下拉选分类 → 菜品网格 → 点开看成品图+做法+视频外链
   - 今日吃什么：SVG 转盘随机选菜 → 预选 → 一键生成做菜指南（每道单独罗列）
   - 导入菜单：粘贴小红书/抖音链接经服务端解析（标题+正文+封面），或粘贴文字规则解析
   - 内置精选菜谱数据集（覆盖 菜系/食材/做法/餐别）
   - 真实图片优先走「导入菜单」的封面；内置数据用 SVG 占位（离线可用、不破图）
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};
(function () {
  var U = App.U, S = App.Store;
  var API = (window.APP_CONFIG && window.APP_CONFIG.PARSE_API) || 'https://test-project-ek2.pages.dev/api/parse-link';

  /* ---------- 分类体系 ---------- */
  var CATS = [
    { group: '菜系', items: [
      { id: 'guangdong', name: '广东菜' }, { id: 'hunan', name: '湖南菜' },
      { id: 'sichuan', name: '四川菜' }, { id: 'thai', name: '泰国菜' },
      { id: 'western', name: '西式' }
    ] },
    { group: '食材', items: [
      { id: 'seafood', name: '海鲜' }, { id: 'veg', name: '素菜' },
      { id: 'meat', name: '肉菜' }, { id: 'poultry', name: '禽蛋' }
    ] },
    { group: '做法', items: [
      { id: 'baking', name: '烘焙' }, { id: 'soup', name: '汤羹' }, { id: 'cold', name: '凉拌' }
    ] },
    { group: '餐别', items: [
      { id: 'breakfast', name: '早餐' }, { id: 'lunch', name: '午餐' },
      { id: 'dinner', name: '晚餐' }, { id: 'late', name: '宵夜' }
    ] }
  ];
  var catMap = {};
  CATS.forEach(function (g) { g.items.forEach(function (it) { catMap[it.id] = it.name; }); });

  /* ---------- 占位图（离线、不破图，中文可渲染） ---------- */
  function ph(name, hue) {
    hue = (hue == null) ? 220 : hue;
    var bg = 'hsl(' + hue + ',45%,93%)', fg = 'hsl(' + hue + ',55%,32%)';
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>"
      + "<rect width='100%' height='100%' fill='" + bg + "'/>"
      + "<text x='50%' y='50%' font-size='38' fill='" + fg + "' text-anchor='middle' dominant-baseline='middle' font-family='PingFang SC,Microsoft YaHei,sans-serif'>" + (name || '菜品') + "</text>"
      + "<text x='50%' y='86%' font-size='16' fill='" + fg + "' text-anchor='middle' font-family='PingFang SC,Microsoft YaHei,sans-serif' opacity='0.7'>（示例图·可导入替换）</text>"
      + "</svg>";
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ---------- 内置精选菜谱 ---------- */
  // cats 用分类 id；hue 仅用于占位图配色
  var RECIPES = [
    { id: 'hongshao-paigu', name: '红烧排骨', cats: ['sichuan', 'meat', 'dinner'], hue: 10,
      ingredients: ['排骨500g', '冰糖', '生抽', '老抽', '料酒', '葱姜', '八角'],
      steps: ['排骨冷水下锅焯水去血沫', '锅中炒冰糖至焦糖色', '下排骨翻炒上色', '加生抽老抽料酒与热水，放八角葱姜', '小火炖40分钟，大火收汁'] },
    { id: 'lazi-ji', name: '辣子鸡', cats: ['sichuan', 'meat', 'dinner'], hue: 12,
      ingredients: ['鸡腿肉', '干辣椒', '花椒', '葱姜蒜', '料酒', '生抽', '白芝麻'],
      steps: ['鸡肉切丁用料酒生抽腌15分钟', '油温六成热下鸡丁炸至金黄捞出', '升高油温复炸一次更酥', '底油爆香干辣椒花椒葱姜蒜', '回锅翻炒撒白芝麻出锅'] },
    { id: 'suanrong-bocai', name: '蒜蓉菠菜', cats: ['veg', 'dinner'], hue: 130,
      ingredients: ['菠菜', '蒜末', '盐', '蚝油'],
      steps: ['菠菜焯水10秒捞出过凉', '热油爆香蒜末', '下菠菜快速翻炒', '加盐蚝油调味出锅'] },
    { id: 'dongyin', name: '冬阴功汤', cats: ['thai', 'soup', 'dinner'], hue: 30,
      ingredients: ['鲜虾', '香茅', '柠檬叶', '椰浆', '冬阴功酱', '青柠', '蘑菇'],
      steps: ['清水煮香茅柠檬叶出味', '加冬阴功酱煮开', '下虾与蘑菇煮熟', '倒入椰浆煮2分钟', '关火挤青柠汁'] },
    { id: 'gongbao', name: '宫保鸡丁', cats: ['sichuan', 'poultry', 'dinner'], hue: 15,
      ingredients: ['鸡胸肉', '花生米', '干辣椒', '葱姜', '酱油', '醋', '糖'],
      steps: ['鸡丁用淀粉生抽腌好', '调宫保汁：酱油醋糖淀粉水', '滑炒鸡丁盛出', '爆香干辣椒葱姜，下花生', '倒回鸡丁淋汁快速炒匀'] },
    { id: 'qingzheng-luyu', name: '清蒸鲈鱼', cats: ['guangdong', 'seafood', 'dinner'], hue: 200,
      ingredients: ['鲈鱼', '葱姜', '蒸鱼豉油', '料酒'],
      steps: ['鱼改刀用料酒抹匀', '盘底铺葱姜放鱼，水开蒸8分钟', '倒掉蒸出的水，铺新葱丝', '淋滚烫热油激香', '浇蒸鱼豉油即可'] },
    { id: 'mapo-tofu', name: '麻婆豆腐', cats: ['sichuan', 'veg', 'dinner'], hue: 8,
      ingredients: ['嫩豆腐', '肉末', '豆瓣酱', '花椒粉', '蒜苗', '淀粉'],
      steps: ['豆腐切块焯水去豆腥', '炒肉末加豆瓣酱出红油', '加水煮开放豆腐', '勾芡收汁', '撒花椒粉与蒜苗段'] },
    { id: 'hainan-ji', name: '海南鸡饭', cats: ['thai', 'poultry', 'lunch'], hue: 40,
      ingredients: ['三黄鸡', '香米', '姜', '蒜', '盐', '酱油', '黄瓜'],
      steps: ['整鸡浸熟后过冰水皮更爽', '用鸡汤加盐煮米饭', '姜蒜剁蓉加酱油作蘸料', '鸡斩件装盘配黄瓜', '配鸡饭与蘸料同食'] },
    { id: 'tiramisu', name: '提拉米苏', cats: ['western', 'baking', 'late'], hue: 28,
      ingredients: ['马斯卡彭', '手指饼', '浓缩咖啡', '可可粉', '鸡蛋', '糖'],
      steps: ['蛋黄加糖打发拌入芝士', '蛋白打发翻拌进芝士糊', '手指饼蘸咖啡铺底', '一层饼一层芝士糊叠好', '冷藏4小时撒可可粉'] },
    { id: 'tangcu-liji', name: '糖醋里脊', cats: ['meat', 'dinner'], hue: 18,
      ingredients: ['里脊肉', '番茄酱', '白醋', '糖', '淀粉', '白芝麻'],
      steps: ['里脊切条用盐腌裹淀粉', '油温六成炸定型捞出', '升高油温复炸酥脆', '番茄酱醋糖调汁下锅', '倒里脊裹汁撒芝麻'] },
    { id: 'yuxiang-rousi', name: '鱼香肉丝', cats: ['sichuan', 'meat', 'dinner'], hue: 330,
      ingredients: ['猪里脊', '木耳', '胡萝卜', '泡椒', '葱姜蒜', '鱼香汁'],
      steps: ['肉切丝用淀粉腌', '调鱼香汁：醋糖酱油淀粉', '滑炒肉丝盛出', '爆香泡椒葱姜蒜下配菜', '倒肉丝淋汁翻炒'] },
    { id: 'xiangjian-sanwenyu', name: '香煎三文鱼', cats: ['western', 'seafood', 'dinner'], hue: 18,
      ingredients: ['三文鱼排', '黑胡椒', '盐', '柠檬', '黄油'],
      steps: ['三文鱼吸干水分撒盐黑胡椒', '热锅少油皮面朝下煎', '两面各煎2分钟至金黄', '加黄油柠檬汁提香', '出锅挤柠檬'] },
    { id: 'baqie-ji', name: '白切鸡', cats: ['guangdong', 'poultry', 'lunch'], hue: 45,
      ingredients: ['三黄鸡', '姜葱', '盐', '花生油'],
      steps: ['整鸡浸微沸汤中煮15分钟', '关火焖10分钟过冰水', '姜葱剁蓉加盐淋热油', '鸡斩件蘸葱姜茸'] },
    { id: 'guangshi-chashao', name: '广式叉烧', cats: ['guangdong', 'meat', 'lunch'], hue: 5,
      ingredients: ['梅花肉', '叉烧酱', '蜂蜜', '生抽', '蒜'],
      steps: ['肉用叉烧酱生抽蒜腌隔夜', '烤箱200度烤20分钟', '刷蜂蜜水翻面再烤15分钟', '出炉切片'] },
    { id: 'laohuo-tang', name: '老火靓汤', cats: ['guangdong', 'soup', 'dinner'], hue: 30,
      ingredients: ['排骨', '莲藕/玉米', '胡萝卜', '蜜枣', '姜'],
      steps: ['排骨焯水', '所有材料入砂锅', '大火烧开转小火煲2小时', '加盐调味'] },
    { id: 'gancha-niuhe', name: '干炒牛河', cats: ['guangdong', 'meat', 'lunch'], hue: 25,
      ingredients: ['河粉', '牛肉', '芽菜', '葱', '生抽', '老抽'],
      steps: ['牛肉腌好滑炒盛出', '大火爆香葱段芽菜', '下河粉快速翻炒', '加生抽老抽调味', '回牛肉炒匀'] },
    { id: 'duojiao-yutou', name: '剁椒鱼头', cats: ['hunan', 'seafood', 'dinner'], hue: 350,
      ingredients: ['鱼头', '剁椒', '蒜', '姜', '蒸鱼豉油', '葱花'],
      steps: ['鱼头剖开用盐和料酒腌', '铺满剁椒蒜姜上锅蒸12分钟', '倒掉水淋蒸鱼豉油', '撒葱花淋热油'] },
    { id: 'lajiao-chaorou', name: '辣椒炒肉', cats: ['hunan', 'meat', 'dinner'], hue: 10,
      ingredients: ['五花肉', '青椒', '蒜', '生抽', '豆豉'],
      steps: ['五花肉切片', '煸炒出油至微焦', '下蒜与青椒翻炒', '加生抽豆豉调味'] },
    { id: 'dongan-ziji', name: '东安子鸡', cats: ['hunan', 'poultry', 'dinner'], hue: 40,
      ingredients: ['仔鸡', '红椒', '姜', '醋', '花椒', '蒜'],
      steps: ['鸡煮熟撕条', '姜蒜红椒爆香', '下鸡条加醋花椒翻炒', '调味出锅'] },
    { id: 'shuizhu-niurou', name: '水煮牛肉', cats: ['sichuan', 'meat', 'dinner'], hue: 5,
      ingredients: ['牛肉', '豆芽', '豆瓣酱', '干辣椒', '花椒', '蒜苗'],
      steps: ['牛肉切片上浆', '炒豆瓣酱加水煮豆芽垫底', '下牛肉滑熟连汤倒碗', '铺干辣椒花椒蒜苗', '淋滚油激香'] },
    { id: 'huiguorou', name: '回锅肉', cats: ['sichuan', 'meat', 'dinner'], hue: 12,
      ingredients: ['五花肉', '青蒜', '豆瓣酱', '甜面酱', '豆豉'],
      steps: ['五花肉煮八分熟切片', '煸炒出油卷曲', '下豆瓣酱甜面酱炒香', '加青蒜段翻炒'] },
    { id: 'fuzhi-feipian', name: '夫妻肺片', cats: ['sichuan', 'meat', 'cold', 'lunch'], hue: 20,
      ingredients: ['牛肉', '牛杂', '花椒', '辣椒油', '芝麻', '香菜'],
      steps: ['牛肉牛杂卤熟切薄片', '调红油花椒芝麻汁', '浇汁拌匀', '撒香菜'] },
    { id: 'taishi-chahefen', name: '泰式炒河粉', cats: ['thai', 'meat', 'lunch'], hue: 35,
      ingredients: ['河粉', '虾仁', '鸡蛋', '豆芽', '花生', '罗望子酱'],
      steps: ['虾仁炒熟推一边炒蛋', '下河粉与豆芽', '加罗望子酱糖鱼露炒匀', '撒花生碎'] },
    { id: 'lv-gali-ji', name: '绿咖喱鸡', cats: ['thai', 'poultry', 'dinner'], hue: 90,
      ingredients: ['鸡腿', '绿咖喱酱', '椰浆', '茄子', '罗勒'],
      steps: ['炒香绿咖喱酱', '下鸡腿翻炒', '倒椰浆煮开', '加茄子煮至软', '撒罗勒'] },
    { id: 'mangguo-nuomi', name: '芒果糯米饭', cats: ['thai', 'veg', 'late'], hue: 45,
      ingredients: ['糯米', '芒果', '椰浆', '糖', '盐'],
      steps: ['糯米泡2小时蒸熟', '椰浆加糖盐煮开拌饭', '芒果切片', '糯米饭配芒果淋椰浆'] },
    { id: 'yishi-roujiangmian', name: '意式肉酱面', cats: ['western', 'meat', 'lunch'], hue: 15,
      ingredients: ['意面', '牛肉末', '番茄', '洋葱', '蒜', '番茄膏'],
      steps: ['意面煮9分钟捞出', '炒香洋葱蒜下肉末', '加番茄番茄膏熬酱', '酱拌面撒芝士'] },
    { id: 'kaisa-shala', name: '凯撒沙拉', cats: ['western', 'veg', 'lunch'], hue: 80,
      ingredients: ['罗马生菜', '面包丁', '帕玛森', '蛋黄酱', '柠檬', '蒜'],
      steps: ['生菜撕块', '调凯撒汁：蛋黄酱柠檬蒜', '拌入生菜面包丁', '撒帕玛森'] },
    { id: 'jian-niupai', name: '煎牛排', cats: ['western', 'meat', 'dinner'], hue: 10,
      ingredients: ['牛排', '黑胡椒', '盐', '黄油', '迷迭香'],
      steps: ['牛排回温撒盐黑胡椒', '热锅大火每面煎2分钟', '加黄油迷迭香淋面', '静置5分钟切片'] },
    { id: 'suanrong-fensi-xiaming', name: '蒜蓉粉丝蒸虾', cats: ['seafood', 'dinner'], hue: 200,
      ingredients: ['基围虾', '粉丝', '蒜', '蒸鱼豉油', '葱花'],
      steps: ['粉丝泡软垫底', '虾开背去虾线摆盘', '爆香蒜蓉铺虾上', '蒸8分钟淋豉油撒葱', '淋热油'] },
    { id: 'suanrong-xilanhua', name: '蒜蓉西兰花', cats: ['veg', 'dinner'], hue: 130,
      ingredients: ['西兰花', '蒜末', '盐', '蚝油'],
      steps: ['西兰花焯水1分钟', '爆香蒜末', '下西兰花翻炒', '加盐蚝油'] },
    { id: 'disancai', name: '地三鲜', cats: ['veg', 'dinner'], hue: 120,
      ingredients: ['土豆', '茄子', '青椒', '蒜', '生抽', '糖'],
      steps: ['土豆茄子炸至金黄', '青椒过油', '爆香蒜调汁', '下三鲜翻炒收汁'] },
    { id: 'liangban-huanggua', name: '凉拌黄瓜', cats: ['veg', 'cold', 'lunch'], hue: 130,
      ingredients: ['黄瓜', '蒜', '醋', '生抽', '辣椒油', '香油'],
      steps: ['黄瓜拍碎切段', '蒜剁蓉', '加醋生抽辣椒油香油拌匀', '冷藏更爽'] },
    { id: 'ganbian-sijidou', name: '干煸四季豆', cats: ['veg', 'dinner'], hue: 110,
      ingredients: ['四季豆', '肉末', '芽菜', '干辣椒', '花椒'],
      steps: ['四季豆炸至起皱', '炒香肉末芽菜干辣椒', '下四季豆翻炒调味'] },
    { id: 'hongshao-rou', name: '红烧肉', cats: ['meat', 'dinner'], hue: 8,
      ingredients: ['五花肉', '冰糖', '生抽', '老抽', '葱姜', '八角'],
      steps: ['五花肉切块焯水', '炒糖色下肉翻炒', '加调料与热水', '小火炖50分钟收汁'] },
    { id: 'kele-jichi', name: '可乐鸡翅', cats: ['poultry', 'dinner'], hue: 25,
      ingredients: ['鸡翅', '可乐', '生抽', '姜'],
      steps: ['鸡翅划口焯水', '煎至两面金黄', '倒入可乐与生抽', '大火收汁裹亮'] },
    { id: 'jianbing-guozi', name: '煎饼果子', cats: ['breakfast', 'lunch'], hue: 40,
      ingredients: ['面粉', '鸡蛋', '油条', '甜面酱', '葱花', '香菜'],
      steps: ['调面糊摊薄饼', '打蛋撒葱花', '刷甜面酱放油条', '卷起切段'] },
    { id: 'jidan-guanbing', name: '鸡蛋灌饼', cats: ['breakfast'], hue: 42,
      ingredients: ['面粉', '鸡蛋', '葱', '盐', '油'],
      steps: ['面团擀薄抹油对折', '煎至鼓起灌入蛋液', '两面煎熟刷酱'] },
    { id: 'pidan-shourou-zhou', name: '皮蛋瘦肉粥', cats: ['breakfast', 'guangdong'], hue: 35,
      ingredients: ['大米', '皮蛋', '瘦肉', '姜丝', '盐'],
      steps: ['大米煮粥', '瘦肉腌好皮蛋切丁', '粥将好下肉与皮蛋', '加盐姜丝'] },
    { id: 'xishi-jidan', name: '西式煎蛋', cats: ['western', 'breakfast'], hue: 45,
      ingredients: ['鸡蛋', '黄油', '盐', '黑胡椒'],
      steps: ['小火融化黄油', '打入鸡蛋', '撒盐黑胡椒', '煎至蛋白凝固蛋黄流心'] },
    { id: 'xihongshi-jidan-tang', name: '西红柿鸡蛋汤', cats: ['soup', 'dinner'], hue: 10,
      ingredients: ['西红柿', '鸡蛋', '葱', '盐', '香油'],
      steps: ['西红柿炒出汁', '加水煮开', '淋蛋液成花', '盐香油葱花'] },
    { id: 'zicai-danhua-tang', name: '紫菜蛋花汤', cats: ['soup', 'dinner'], hue: 200,
      ingredients: ['紫菜', '鸡蛋', '虾皮', '葱', '盐'],
      steps: ['水开下紫菜虾皮', '淋蛋液', '盐葱花香油'] },
    { id: 'koushui-ji', name: '口水鸡', cats: ['sichuan', 'cold', 'lunch'], hue: 20,
      ingredients: ['鸡腿', '红油', '花椒', '芝麻', '葱姜', '糖'],
      steps: ['鸡腿煮熟过冰水', '调红油花椒芝麻汁', '鸡撕条浇汁', '撒芝麻'] },
    { id: 'mala-tang', name: '麻辣烫', cats: ['sichuan', 'late', 'meat'], hue: 8,
      ingredients: ['丸子', '蔬菜', '豆腐', '麻辣底料', '蒜泥'],
      steps: ['底料炒香加水', '先下耐煮丸子', '再下蔬菜豆腐', '煮熟蘸蒜泥'] },
    { id: 'kaolengmian', name: '烤冷面', cats: ['late', 'breakfast'], hue: 30,
      ingredients: ['冷面皮', '鸡蛋', '香肠', '甜辣酱', '葱'],
      steps: ['平底锅放面皮打蛋', '翻面刷甜辣酱', '放香肠葱', '卷起切段'] },
    { id: 'qifeng-dangao', name: '戚风蛋糕', cats: ['baking', 'late'], hue: 35,
      ingredients: ['鸡蛋', '低筋粉', '糖', '牛奶', '油'],
      steps: ['蛋黄加奶油画糊', '蛋白加糖打发', '翻拌入模', '150度烤50分钟倒扣放凉'] },
    { id: 'quqi-binggan', name: '曲奇饼干', cats: ['baking'], hue: 28,
      ingredients: ['黄油', '低筋粉', '糖', '鸡蛋'],
      steps: ['黄油糖打发', '加蛋液面粉拌团', '挤花入盘', '180度烤12分钟'] },
    { id: 'xiangjiao-mianbao', name: '香蕉面包', cats: ['baking', 'breakfast'], hue: 40,
      ingredients: ['香蕉', '面粉', '鸡蛋', '糖', '泡打粉'],
      steps: ['香蕉压泥', '混合所有材料', '入模', '175度烤40分钟'] }
  ];

  // 转盘候选池（精选代表性菜品，标签可读）
  var WHEEL_IDS = ['hongshao-paigu', 'lazi-ji', 'suanrong-bocai', 'dongyin', 'gongbao',
    'qingzheng-luyu', 'mapo-tofu', 'hainan-ji', 'tiramisu', 'tangcu-liji',
    'yuxiang-rousi', 'xiangjian-sanwenyu'];

  /* ---------- 存储 ---------- */
  var IMPORT_KEY = 'recipes_imported';
  var PRESELECT_KEY = 'recipes_preselect';
  function getImported() { return S.get(IMPORT_KEY, []); }
  function setImported(a) { S.set(IMPORT_KEY, a); }
  function getPreselect() { return S.get(PRESELECT_KEY, []); }
  function setPreselect(a) { S.set(PRESELECT_KEY, a); }

  function findDish(id) {
    var all = RECIPES.concat(getImported());
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function dishImage(d) { return (d && d.image) ? d.image : ph(d ? d.name : '', d ? d.hue : 220); }
  function dishTags(d) {
    var out = [];
    (d.cats || []).forEach(function (c) { if (c === 'imported') out.push('导入'); else if (catMap[c]) out.push(catMap[c]); });
    if (d.platformLabel) out.push(d.platformLabel);
    return out;
  }

  /* ---------- 规则解析文字 → 结构化 ---------- */
  function parseText(raw) {
    var lines = String(raw || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var title = lines[0] || '未命名菜单';
    var ingredients = [], steps = [], mode = null;
    for (var i = 1; i < lines.length; i++) {
      var ln = lines[i];
      if (/^(食材|配料|原料|材料|用料)/.test(ln)) { mode = 'ing'; continue; }
      if (/^(做法|步骤|制作|工序|方法|操作)/.test(ln)) { mode = 'step'; continue; }
      var cleaned = ln.replace(/^[0-9]+[.、)]\s*/, '');
      if (mode === 'ing') ingredients.push(cleaned);
      else if (mode === 'step') steps.push(cleaned);
      else if (/^[0-9]+[.、)]/.test(ln)) steps.push(cleaned);
      else ingredients.push(cleaned);
    }
    return { title: title, ingredients: ingredients, steps: steps, text: raw };
  }

  /* ---------- 页面渲染 ---------- */
  App.pages['recipes'] = function (root) {
    U.clear(root);

    /* 顶部快速入口 */
    var quick = U.el('div', { class: 'filter-bar', style: 'position:sticky;top:0;background:var(--bg);z-index:5;padding:6px 0' });
    function mkQuick(label, targetId) {
      return U.el('button', { class: 'tag', text: label, onclick: function () {
        var el = U.$('#' + targetId); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } });
    }
    quick.appendChild(mkQuick('🍽 菜谱分类', 'sec-cats'));
    quick.appendChild(mkQuick('🎯 今日吃什么', 'sec-wheel'));
    quick.appendChild(mkQuick('📥 导入菜单', 'sec-import'));
    root.appendChild(quick);

    /* ===== 菜谱分类 ===== */
    var catsCard = U.el('div', { class: 'card', id: 'sec-cats' });
    catsCard.appendChild(U.el('div', { class: 'card-title', text: '🍽 菜谱分类' }));
    var sel = U.el('select', { class: 'input', style: 'max-width:240px;margin-bottom:14px', onchange: function () { renderGrid(sel.value, grid); } });
    sel.appendChild(U.el('option', { value: 'all', text: '全部菜品' }));
    CATS.forEach(function (g) {
      var og = U.el('optgroup', { label: g.group });
      g.items.forEach(function (it) { og.appendChild(U.el('option', { value: it.id, text: it.name })); });
      sel.appendChild(og);
    });
    catsCard.appendChild(sel);
    var grid = U.el('div', { class: 'grid c3' });
    catsCard.appendChild(grid);
    root.appendChild(catsCard);
    renderGrid('all', grid);

    /* ===== 今日吃什么 转盘 ===== */
    var wheelCard = U.el('div', { class: 'card', id: 'sec-wheel' });
    wheelCard.appendChild(U.el('div', { class: 'card-title', text: '🎯 今日吃什么' }));
    wheelCard.appendChild(U.el('div', { class: 'muted', style: 'margin-bottom:10px', text: '点「开始转动」，随机帮你选一道菜；满意就加入预选，最后一键生成做菜指南。' }));

    var wheelWrap = U.el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:12px' });
    var wheelBox = U.el('div', { style: 'position:relative;width:300px;height:300px' });
    var wheelSvg = buildWheelSVG();
    wheelBox.innerHTML = wheelSvg;
    wheelWrap.appendChild(wheelBox);
    var spinBtn = U.el('button', { class: 'btn', text: '开始转动', onclick: function () { spinWheel(); } });
    wheelWrap.appendChild(spinBtn);

    var resultBox = U.el('div', { id: 'wheelResult', style: 'min-height:20px;text-align:center' });
    wheelWrap.appendChild(resultBox);
    wheelCard.appendChild(wheelWrap);

    // 预选区
    wheelCard.appendChild(U.el('div', { class: 'card-sub', style: 'margin:14px 0 6px', text: '🧺 预选菜单' }));
    var preBox = U.el('div', { class: 'row wrap', id: 'preselectBox' });
    wheelCard.appendChild(preBox);
    var genBtn = U.el('button', { class: 'btn ghost sm', style: 'margin-top:10px', text: '📋 一键生成做菜指南', onclick: function () { generateGuide(); } });
    wheelCard.appendChild(genBtn);
    root.appendChild(wheelCard);
    renderPreselect(preBox);

    /* ===== 导入菜单 ===== */
    var impCard = U.el('div', { class: 'card', id: 'sec-import' });
    impCard.appendChild(U.el('div', { class: 'card-title', text: '📥 导入菜单' }));
    impCard.appendChild(U.el('div', { class: 'muted', style: 'margin-bottom:10px', text: '粘贴小红书 / 抖音分享链接，自动提取标题、正文与封面图（文字稳、图片可能过期，可用占位兜底）。也可以直接粘贴笔记文字。' }));

    var linkInput = U.el('input', { class: 'input', placeholder: '粘贴链接，如 https://v.douyin.com/xxx 或 https://xhslink.cn/xxx', style: 'margin-bottom:8px' });
    impCard.appendChild(linkInput);
    var linkRow = U.el('div', { class: 'row' });
    linkRow.appendChild(U.el('button', { class: 'btn sm', text: '解析链接', onclick: function () { parseLink(linkInput.value, previewBox); } }));
    linkRow.appendChild(U.el('span', { class: 'muted', style: 'align-self:center', text: '或' }));
    impCard.appendChild(linkRow);

    var ta = U.el('textarea', { class: 'textarea', placeholder: '也可直接粘贴笔记文字（自动按 食材/做法 关键词切分）', style: 'margin-top:8px' });
    impCard.appendChild(ta);
    impCard.appendChild(U.el('button', { class: 'btn ghost sm', style: 'margin-top:8px', text: '解析文字', onclick: function () { parseTextInput(ta.value, previewBox); } }));

    var previewBox = U.el('div', { id: 'importPreview', style: 'margin-top:12px' });
    impCard.appendChild(previewBox);
    root.appendChild(impCard);

    /* ---------- 转盘逻辑 ---------- */
    var wheelRot = 0, spinning = false;
    var pool = WHEEL_IDS.map(findDish).filter(Boolean);
    var rotG = wheelBox.querySelector('#wheelRot');
    if (rotG) { rotG.style.transformBox = 'view-box'; rotG.style.transformOrigin = '150px 150px'; }
    function spinWheel() {
      if (spinning) return; spinning = true;
      if (!pool.length) { U.toast('转盘菜品为空'); spinning = false; return; }
      var N = pool.length, step = 360 / N;
      var idx = Math.floor(Math.random() * N);
      var desired = (360 - (idx * step + step / 2)) % 360;
      var curMod = ((wheelRot % 360) + 360) % 360;
      var delta = (desired - curMod + 360) % 360;
      wheelRot += 360 * 5 + delta;
      rotG.style.transition = 'transform 4s cubic-bezier(.17,.67,.3,1.15)';
      rotG.style.transform = 'rotate(' + wheelRot + 'deg)';
      U.clear(resultBox); resultBox.appendChild(U.el('div', { class: 'muted', text: '转动中…' }));
      setTimeout(function () {
        spinning = false;
        var d = pool[idx];
        U.clear(resultBox);
        var line = U.el('div', { style: 'font-weight:800;font-size:18px' });
        line.appendChild(U.el('span', { text: '今天就吃：' }));
        line.appendChild(U.el('span', { style: 'color:var(--brand)', text: d.name }));
        resultBox.appendChild(line);
        resultBox.appendChild(U.el('button', { class: 'btn sm', style: 'margin-top:8px', text: '✓ 预选此菜', onclick: function () { addPreselect(d.id); U.toast('已加入预选：' + d.name); } }));
      }, 4100);
    }

    function renderGrid(catId, gridEl) {
      U.clear(gridEl);
      var list = RECIPES.concat(getImported());
      if (catId && catId !== 'all') list = list.filter(function (d) { return (d.cats || []).indexOf(catId) > -1; });
      if (!list.length) { gridEl.appendChild(U.el('div', { class: 'empty', text: '该分类暂无菜品' })); return; }
      list.forEach(function (d) {
        var card = U.el('div', { class: 'dish-card', onclick: function () { showDish(d); } });
        card.appendChild(U.el('img', { class: 'dish-img', src: dishImage(d), onerror: function () { this.src = ph(d.name, d.hue); } }));
        var info = U.el('div', { class: 'dish-info' });
        info.appendChild(U.el('div', { class: 'dish-name', text: d.name }));
        var tags = U.el('div', { class: 'dish-tags' });
        dishTags(d).slice(0, 3).forEach(function (t) { tags.appendChild(U.el('span', { class: 'tag xs', text: t })); });
        info.appendChild(tags);
        card.appendChild(info);
        gridEl.appendChild(card);
      });
    }

    function showDish(d) {
      var body = U.el('div');
      body.appendChild(U.el('img', { src: dishImage(d), style: 'width:100%;border-radius:12px;margin-bottom:12px;background:var(--surface-3)', onerror: function () { this.src = ph(d.name, d.hue); } }));
      var tags = U.el('div', { class: 'row wrap', style: 'margin-bottom:8px' });
      dishTags(d).forEach(function (t) { tags.appendChild(U.el('span', { class: 'tag xs', text: t })); });
      body.appendChild(tags);
      if (d.ingredients && d.ingredients.length) {
        body.appendChild(U.el('div', { class: 'card-sub', style: 'margin:6px 0 4px', text: '🥬 食材' }));
        body.appendChild(U.el('div', { text: d.ingredients.join('、') }));
      }
      if (d.steps && d.steps.length) {
        body.appendChild(U.el('div', { class: 'card-sub', style: 'margin:10px 0 4px', text: '👩‍🍳 做法' }));
        d.steps.forEach(function (s, i) { body.appendChild(U.el('div', { style: 'margin:4px 0', text: (i + 1) + '. ' + s })); });
      } else if (d.text) {
        body.appendChild(U.el('div', { class: 'card-sub', style: 'margin:10px 0 4px', text: '📝 原文' }));
        body.appendChild(U.el('div', { style: 'white-space:pre-wrap;line-height:1.6', text: d.text }));
      }
      if (d.video) body.appendChild(U.el('a', { class: 'btn sm', style: 'margin-top:12px;display:inline-block;text-decoration:none', href: d.video, target: '_blank', rel: 'noopener', text: '▶ 看视频' }));
      U.modal({
        title: d.name, body: body,
        actions: [
          { label: '加入预选', primary: true, onClick: function () { addPreselect(d.id); U.toast('已加入预选'); } },
          { label: '关闭', onClick: function () {} }
        ]
      });
    }

    function addPreselect(id) {
      var arr = getPreselect();
      if (arr.indexOf(id) > -1) { U.toast('已在预选中'); return; }
      arr.push(id); setPreselect(arr); renderPreselect(preBox);
    }
    function renderPreselect(box) {
      U.clear(box);
      var arr = getPreselect();
      if (!arr.length) { box.appendChild(U.el('span', { class: 'muted', text: '还没有预选，去转盘或菜品里加点菜吧～' })); return; }
      arr.forEach(function (id) {
        var d = findDish(id); if (!d) return;
        var chip = U.el('span', { class: 'tag removable', text: d.name, onclick: function () {
          var a = getPreselect().filter(function (x) { return x !== id; }); setPreselect(a); renderPreselect(box);
        } });
        box.appendChild(chip);
      });
    }

    function generateGuide() {
      var arr = getPreselect();
      if (!arr.length) { U.toast('请先预选至少一道菜'); return; }
      var dishes = arr.map(findDish).filter(Boolean);
      var body = U.el('div');
      var actions = U.el('div', { class: 'row', style: 'margin-bottom:10px' });
      actions.appendChild(U.el('button', { class: 'btn sm', text: '📋 复制全文', onclick: function () { copyText(buildGuideText(dishes)); } }));
      actions.appendChild(U.el('button', { class: 'btn ghost sm', text: '⬇ 下载TXT', onclick: function () { U.download('做菜指南_' + S.todayStr() + '.txt', buildGuideText(dishes), 'text/plain;charset=utf-8'); } }));
      actions.appendChild(U.el('button', { class: 'btn ghost sm', text: '⭐ 存到灵感', onclick: function () { saveToInspiration(dishes); } }));
      body.appendChild(actions);
      dishes.forEach(function (d, i) {
        body.appendChild(U.el('div', { style: 'font-weight:800;font-size:16px;margin:12px 0 6px', text: (i + 1) + '. ' + d.name }));
        body.appendChild(U.el('img', { src: dishImage(d), style: 'width:100%;border-radius:10px;margin-bottom:8px;background:var(--surface-3)', onerror: function () { this.src = ph(d.name, d.hue); } }));
        if (d.ingredients && d.ingredients.length) body.appendChild(U.el('div', { class: 'muted', style: 'font-size:13px', text: '食材：' + d.ingredients.join('、') }));
        if (d.steps && d.steps.length) {
          d.steps.forEach(function (s, k) { body.appendChild(U.el('div', { style: 'margin:3px 0', text: (k + 1) + ') ' + s })); });
        } else if (d.text) {
          body.appendChild(U.el('div', { style: 'white-space:pre-wrap;line-height:1.6', text: d.text }));
        }
        if (d.sourceUrl) body.appendChild(U.el('a', { class: 'muted', style: 'font-size:12px;display:block;margin-top:4px', href: d.sourceUrl, target: '_blank', rel: 'noopener', text: '🔗 原链接' }));
      });
      U.modal({ title: '今日做菜指南', body: body, actions: [{ label: '关闭', primary: true, onClick: function () {} }] });
    }

    function buildGuideText(dishes) {
      var d0 = new Date();
      var head = '今日做菜指南（生成于 ' + S.todayStr() + ' ' + U.fmtTime(d0) + '）\n' + '='.repeat(24) + '\n';
      return head + dishes.map(function (d, i) {
        var lines = [(i + 1) + '. ' + d.name];
        if (d.ingredients && d.ingredients.length) lines.push('【食材】' + d.ingredients.join('、'));
        if (d.steps && d.steps.length) lines.push('【做法】\n' + d.steps.map(function (s, k) { return '  ' + (k + 1) + ') ' + s; }).join('\n'));
        else if (d.text) lines.push('【原文】\n' + d.text);
        if (d.sourceUrl) lines.push('原链接：' + d.sourceUrl);
        return lines.join('\n');
      }).join('\n' + '-'.repeat(24) + '\n');
    }

    function saveToInspiration(dishes) {
      try {
        var arr = S.getInspirations ? S.getInspirations() : [];
        var d = new Date();
        var hhmm = U.fmtTime(d);
        arr.unshift({
          id: U.uid(), content: buildGuideText(dishes), tags: ['菜谱', '做菜指南'],
          date: S.todayStr(), time: hhmm, pinned: false, starred: false, attachments: []
        });
        if (S.saveInspirations) S.saveInspirations(arr);
        U.toast('已存入灵感记录，可在「灵感记录」查看');
      } catch (e) { U.toast('保存失败：' + (e.message || e)); }
    }

    /* ---------- 导入逻辑 ---------- */
    function setPreview(kind, msg, node) {
      U.clear(previewBox);
      if (kind === 'loading') previewBox.appendChild(U.el('div', { class: 'muted', text: msg }));
      else if (kind === 'error') previewBox.appendChild(U.el('div', { style: 'color:var(--red);font-size:13px', text: '⚠ ' + msg }));
      else if (node) previewBox.appendChild(node);
    }

    function buildImportPreview(parsed, sourceUrl, platformLabel) {
      var node = U.el('div', { class: 'import-preview' });
      node.appendChild(U.el('div', { class: 'card-sub', text: '解析结果（' + (platformLabel || '链接') + '）' }));
      if (parsed.image) node.appendChild(U.el('img', { src: parsed.image, style: 'width:140px;border-radius:10px;margin:6px 0;background:var(--surface-3)', onerror: function () { this.style.display = 'none'; } }));
      node.appendChild(U.el('div', { style: 'font-weight:800;font-size:15px', text: parsed.title || '未命名' }));
      if (parsed.ingredients && parsed.ingredients.length) node.appendChild(U.el('div', { class: 'muted', style: 'font-size:13px;margin-top:4px', text: '食材：' + parsed.ingredients.join('、') }));
      if (parsed.steps && parsed.steps.length) {
        node.appendChild(U.el('div', { class: 'muted', style: 'font-size:13px;margin-top:4px', text: '做法：' + parsed.steps.length + ' 步' }));
      } else if (parsed.text) {
        node.appendChild(U.el('div', { style: 'white-space:pre-wrap;font-size:13px;margin-top:4px;max-height:160px;overflow:auto', text: parsed.text }));
      }
      node.appendChild(U.el('button', { class: 'btn sm', style: 'margin-top:8px', text: '💾 保存为我的菜单', onclick: function () {
        saveImported(parsed, sourceUrl, platformLabel);
      } }));
      return node;
    }

    function saveImported(parsed, sourceUrl, platformLabel) {
      var imported = getImported();
      var d = {
        id: 'imp-' + U.uid(), name: parsed.title || '未命名菜单', cats: ['imported'],
        image: parsed.image || '', ingredients: parsed.ingredients || [], steps: parsed.steps || [],
        text: parsed.text || '', video: sourceUrl || '', sourceUrl: sourceUrl || '',
        platformLabel: platformLabel || '', imported: true, hue: 20
      };
      imported.unshift(d); setImported(imported);
      U.toast('已保存到我的菜单（可在「菜谱分类」查看）');
      U.clear(previewBox);
      renderGrid(sel.value, grid);
    }

    function parseLink(url, pbox) {
      url = (url || '').trim();
      if (!url) { U.toast('请先粘贴链接'); return; }
      setPreview('loading', '解析中…');
      U.fetchJSON(API + '?cb=' + Date.now(), 12000).then(function (r) {
        if (!r || !r.ok) { setPreview('error', (r && r.error) ? r.error : '解析失败，请改用粘贴文字'); return; }
        var parsed = parseText(r.text || '');
        parsed.title = r.title || parsed.title;
        parsed.image = (r.images && r.images[0]) || '';
        parsed.text = r.text || '';
        var label = r.platform === 'xiaohongshu' ? '小红书' : (r.platform === 'douyin' ? '抖音' : '链接');
        setPreview('node', '', buildImportPreview(parsed, r.sourceUrl, label));
      }).catch(function (e) {
        setPreview('error', '请求失败：' + (e && e.message ? e.message : e) + '（可改用粘贴文字）');
      });
    }

    function parseTextInput(raw, pbox) {
      raw = (raw || '').trim();
      if (!raw) { U.toast('请先粘贴文字'); return; }
      var parsed = parseText(raw);
      setPreview('node', '', buildImportPreview(parsed, '', '文字'));
    }
  };

  /* ---------- 转盘 SVG 构建 ---------- */
  function polar(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  function sectorPath(cx, cy, r, a0, a1) {
    var p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
    var large = (a1 - a0) > 180 ? 1 : 0;
    return 'M' + cx + ' ' + cy + ' L' + p0.x.toFixed(2) + ' ' + p0.y.toFixed(2)
      + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2) + ' Z';
  }
  function buildWheelSVG() {
    var pool = WHEEL_IDS.map(function (id) {
      var f = RECIPES.filter(function (r) { return r.id === id; })[0]; return f;
    }).filter(Boolean);
    var N = pool.length, step = 360 / N;
    var palette = ['#f45c6d', '#f5871f', '#f5a623', '#3abf7c', '#1db5bd', '#4f6cf7', '#8b6cf7', '#ec6fae', '#ef4848', '#1aad6b', '#f5a623', '#4f6cf7'];
    var s = "<svg viewBox='0 0 300 300' width='300' height='300'>";
    s += "<g id='wheelRot'>";
    for (var i = 0; i < N; i++) {
      var a0 = i * step, a1 = (i + 1) * step;
      s += "<path d='" + sectorPath(150, 150, 140, a0, a1) + "' fill='" + palette[i % palette.length] + "' stroke='#fff' stroke-width='1.5'/>";
      var mid = a0 + step / 2;
      var pos = polar(150, 150, 92, mid);
      var nm = pool[i].name; if (nm.length > 5) nm = nm.slice(0, 5) + '…';
      s += "<text x='" + pos.x.toFixed(1) + "' y='" + pos.y.toFixed(1) + "' transform='rotate(" + mid + ' ' + pos.x.toFixed(1) + ' ' + pos.y.toFixed(1) + ")' font-size='9' fill='#fff' text-anchor='middle' dominant-baseline='middle'>" + nm + '</text>';
    }
    s += "</g>";
    // 中心轴
    s += "<circle cx='150' cy='150' r='20' fill='#fff' stroke='#e8ecf4' stroke-width='2'/>";
    // 顶部指针（固定）
    s += "<path d='M150 4 L141 24 L159 24 Z' fill='#ef4848'/>";
    s += "</svg>";
    return s;
  }
})();
