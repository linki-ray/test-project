/* ============================================================
   今日菜谱 —— 分类浏览 / 今日吃什么转盘 / 一键做菜指南 / 导入菜单
   - 二级类目下拉选分类 → 菜品网格 → 点开看成品图+做法+视频外链
   - 今日吃什么：肉菜 / 青菜 / 汤 三个独立转盘，各自多选预选，已选不重复抽取
   - 一键生成做菜指南：按 肉菜 / 青菜 / 汤 分组，每道单独罗列
   - 导入菜单：粘贴小红书/抖音链接经服务端解析（标题+正文+封面），或粘贴文字规则解析
   - 内置菜谱数据集由真实菜名种子批量生成（肉/青菜/汤 各 100+ 道）
   - 真实图片优先走「导入菜单」的封面；内置数据用 SVG 占位（离线可用、不破图）
   ========================================================= */
window.App = window.App || {};
App.pages = App.pages || {};
(function () {
  var U = App.U, S = App.Store;
  var API = (window.APP_CONFIG && window.APP_CONFIG.PARSE_API) || 'https://test-project-ek2.pages.dev/api/parse-link';

  /* ---------- 分类体系（下拉用，type 复用其中 id） ---------- */
  var CATS = [
    { group: '菜系', items: [
      { id: 'guangdong', name: '广东菜' }, { id: 'hunan', name: '湖南菜' },
      { id: 'sichuan', name: '四川菜' }, { id: 'thai', name: '泰国菜' },
      { id: 'western', name: '西式' }, { id: 'dongbei', name: '东北菜' }
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

  /* ---------- 真实菜名种子（逗号分隔，尽量常见） ---------- */
  var SEED = {
    meat: "红烧肉,红烧排骨,糖醋排骨,糖醋里脊,咕噜肉,回锅肉,鱼香肉丝,宫保鸡丁,麻婆豆腐,水煮牛肉,水煮鱼,辣子鸡,辣子鸡丁,夫妻肺片,毛血旺,酸菜鱼,剁椒鱼头,烤鱼,粉蒸肉,梅菜扣肉,东坡肉,叉烧,蜜汁叉烧,烤鸭,北京烤鸭,盐水鸭,啤酒鸭,白切鸡,盐焗鸡,口水鸡,文昌鸡,叫花鸡,三杯鸡,可乐鸡翅,炸鸡翅,红烧鸡翅,香菇滑鸡,黄焖鸡,大盘鸡,椒盐排条,锅包肉,京酱肉丝,青椒肉丝,蒜薹炒肉,木耳炒肉,荷兰豆炒腊肉,尖椒炒肉,红烧狮子头,四喜丸子,清蒸鲈鱼,红烧鱼块,干烧鱼,香煎带鱼,红烧带鱼,油焖大虾,白灼虾,椒盐虾,蒜蓉粉丝蒸虾,清蒸螃蟹,香辣蟹,红烧牛腩,番茄牛腩,土豆炖牛肉,黑椒牛柳,滑蛋牛肉,孜然牛肉,葱爆羊肉,红烧羊肉,烤羊排,羊肉串,萝卜炖羊肉,红烧猪蹄,卤猪蹄,酱牛肉,卤牛肉,红烧鸡块,香菇炖鸡,板栗烧鸡,照烧鸡腿,炸猪排,红烧丸子,小炒黄牛肉,干锅肥肠,干锅牛蛙,干锅虾,爆炒腰花,咖喱鸡,咖喱牛肉,咖喱虾,椰香咖喱鸡,照烧猪肉,铁板牛肉,黑椒猪排,蜜汁烤肉,烤五花肉,红烧鸡爪,卤鸡爪,泡椒凤爪,藤椒鸡,蒜香骨,豉汁排骨,南瓜蒸排骨,萝卜焖排骨,红烧大虾,香辣虾,孜然羊肉,烤牛肉,煎牛排,黑椒牛排,牛肉饼,鸡肉卷,炸鸡,烤鸡腿,卤鸡腿,白灼鱿鱼,辣炒花蛤,蒜蓉粉丝蒸扇贝,清蒸石斑鱼,香煎龙利鱼,番茄鱼片,酸汤鱼,水煮鱼片,麻辣香锅,干锅菜花,回锅香肠,腊味炒饭,腊肉炒蒜苔,咸肉菜饭,香肠炒蛋,培根炒蛋,火腿炒蛋,午餐肉炒蛋,蒜香排骨,红烧鸡心,卤鸡翅,蜜汁鸡翅,照烧鸡翅,香酥鸡,盐酥鸡,炸鸡排,糖醋鱼块,茄汁大虾,清蒸多宝鱼,剁椒蒸排骨,粉蒸排骨,芋头蒸排骨,梅菜扣肉,南乳扣肉,红烧肉丸,京都排骨,橙汁排骨,红烧牛尾,番茄炖牛尾,萝卜炖牛腩,土豆烧牛肉,红烧海参,油焖大虾,蒜蓉蒸虾,白灼基围虾,椒盐九肚鱼,红烧带鱼,干炸带鱼,香煎银鳕鱼,清蒸鳕鱼,红烧鳕鱼,烤秋刀鱼,照烧鸡腿排,黑椒鸡腿,香菇蒸鸡,手撕鸡,怪味鸡,棒棒鸡,钵钵鸡,干锅鸡,魔芋烧鸭,腊味拼盘,咸蛋黄焗虾,金沙玉米虾仁,黑椒鸡肉肠,台式三杯鸡,泰式柠檬鱼,香茅烤鸡,菠萝咕噜肉,蜜汁烤排骨,照烧鸡排,葱油鸡,白切鸡,盐焗鸡,口水鸡,藤椒鸡,辣子鸡,干锅鸡,泰式炒河粉,绿咖喱鸡,红咖喱牛肉,泰式打抛猪,咖喱蟹,泰式春卷,玛格丽特披萨,夏威夷披萨,意式肉酱面,奶油培根意面,西冷牛排,惠灵顿牛排,红酒炖牛肉,烤鸡翅,洋葱圈,薯条,法式吐司,黑椒牛排,芝士焗龙虾,香草烤鸡,番茄炖牛腩,罗勒炒鸡,锅包肉,猪肉炖粉条,杀猪菜,酸菜白肉,溜肉段,东北乱炖,酱骨头,烤冷面,铁锅炖鱼,大拉皮,小鸡炖蘑菇,得莫利炖鱼,李连贵熏肉,东北春饼,酸菜血肠,熘肥肠,雪衣豆沙",
    veg: "蒜蓉菠菜,清炒菠菜,蒜蓉西兰花,清炒西兰花,干煸四季豆,清炒四季豆,地三鲜,凉拌黄瓜,拍黄瓜,凉拌木耳,凉拌海带,凉拌腐竹,凉拌藕片,凉拌土豆丝,酸辣土豆丝,醋溜土豆丝,红烧茄子,鱼香茄子,尖椒土豆丝,清炒土豆丝,干锅土豆,蚝油生菜,蒜蓉生菜,清炒油麦菜,蒜蓉空心菜,清炒空心菜,上汤娃娃菜,醋溜白菜,手撕包菜,清炒包菜,干锅包菜,西红柿炒鸡蛋,番茄炒蛋,青椒炒蛋,韭黄炒蛋,苦瓜炒蛋,西葫芦炒蛋,葱花炒蛋,清炒丝瓜,蒜蓉丝瓜,清炒冬瓜,虾仁冬瓜,红烧冬瓜,清炒芦笋,白灼芦笋,蒜蓉西葫芦,清炒西葫芦,香菇青菜,蒜蓉娃娃菜,清炒小白菜,上汤菠菜,凉拌秋葵,清炒秋葵,蒜蓉秋葵,干煸豆角,虎皮青椒,酱爆青椒,清炒藕片,醋溜藕片,糖醋藕片,清炒山药,蓝莓山药,拔丝山药,清炒荷兰豆,蒜蓉荷兰豆,腊味荷兰豆,清炒豆芽,醋溜豆芽,凉拌豆芽,凉拌芹菜,西芹百合,腰果西芹,清炒莴笋,蒜蓉莴笋,凉拌莴笋,皮蛋拌豆腐,香椿炒蛋,韭菜炒蛋,韭香豆腐,红烧豆腐,家常豆腐,铁板豆腐,照烧豆腐,清炒芥蓝,白灼芥蓝,蒜蓉芥蓝,清炒茼蒿,凉拌茼蒿,蒜蓉红苋菜,清炒红苋菜,上汤苋菜,凉拌粉皮,清炒笋干,油焖笋,香菇菜心,蒜蓉菜心,白灼菜心,清炒苦瓜,苦瓜酿肉,凉拌苦瓜,清炒南瓜,咸蛋黄南瓜,蒜蓉粉丝蒸娃娃菜,烤茄子,芝士焗红薯,拔丝地瓜,清炒红薯叶,凉拌折耳根,橄榄油炒杂蔬,红烧日本豆腐,蟹黄豆腐,小葱拌豆腐,凉拌豆腐,清炒银耳,白灼秋葵,蒜蓉荷兰豆,清炒芦笋,凉拌蕨菜,清炒莴笋丝,酸辣藕带,凉拌海白菜,蒜蓉盖菜,清炒盖菜,白灼生菜,蚝油蘑菇,清炒口蘑,香菇炒油菜,蒜蓉油菜,凉拌马齿苋,清炒南瓜藤,上汤西洋菜,蒜蓉西洋菜,清炒空心菜梗,凉拌紫甘蓝,醋溜紫甘蓝,清炒紫甘蓝,干锅花菜,清炒花菜,蒜蓉花菜,番茄花菜,凉拌西兰花,白灼西兰花,蒜蓉西蓝花,清炒豆苗,上汤豆苗,蒜蓉豆苗,凉拌海带丝,凉拌黄瓜木耳,拍黄瓜,蒜泥白肉,虎皮尖椒,酱爆茄子,鱼香茄子煲,烧茄子,酱茄子,蒜蓉茄子,烤茄子,芝士焗茄子,凉拌豆腐皮,凉拌千张,韭菜炒香干,芹菜炒香干,雪菜炒毛豆,清炒毛豆,凉拌毛豆,盐水毛豆,清炒蚕豆,凉拌蚕豆,蒜蓉荷兰豆,清炒豌豆,凉拌豌豆,清炒扁豆,干煸扁豆,清炒刀豆,白灼芥蓝,上汤竹荪,清炒竹荪,蒜蓉木耳菜,清炒木耳菜,凉拌蕨根粉,清炒魔芋,凉拌魔芋,金针菇拌黄瓜,凉拌金针菇,蒜蓉金针菇,清炒香菇,香菇西兰花,白灼菜心,上汤娃娃菜,蒜蓉粉丝蒸丝瓜,烤红薯,芝士焗土豆,清炒藕片,凉拌折耳根,烧烤蔬菜,杂蔬沙拉,凯撒沙拉,蔬菜沙拉,凉拌时蔬,清炒时蔬,上汤时蔬,蒜蓉时蔬,清炒杂菜,醋溜白菜,酸辣白菜,干锅白菜,韩式泡菜,酸菜炒粉,地三鲜,凉拌魔芋丝,清炒西芹,腰果西芹百合,凉拌莴笋丝,清炒芦笋尖,烤蔬菜,清炒南瓜尖,上汤竹笙,凉拌海白菜,蒜蓉红薯叶,清炒红菜苔,腊肉炒笋,干锅手撕包菜,青木瓜沙拉,泰式炒空心菜,希腊沙拉,番茄意面,烤蔬菜,芦笋沙拉,牛油果沙拉,焗薯泥,奶油菠菜,橄榄油烤番茄,香草烤蘑菇,玉米烙,地三鲜,东北酱茄子,尖椒干豆腐,酸菜粉,蒜茄子,土豆炖豆角",
    soup: "西红柿鸡蛋汤,紫菜蛋花汤,丝瓜豆腐汤,冬瓜排骨汤,莲藕排骨汤,玉米排骨汤,山药排骨汤,萝卜排骨汤,海带排骨汤,土豆排骨汤,菌菇汤,香菇鸡汤,椰子鸡汤,老母鸡汤,乌鸡汤,鸽子汤,鲫鱼汤,豆腐鲫鱼汤,酸菜鱼汤,番茄鱼片汤,丸子汤,鸡肉丸子汤,牛肉丸子汤,西湖牛肉羹,粟米羹,海鲜羹,鲜虾豆腐汤,虾仁豆腐汤,蛤蜊汤,花蛤豆腐汤,蛏子汤,海带豆腐汤,味噌汤,日式味噌汤,韩式大酱汤,泡菜汤,罗宋汤,奶油蘑菇汤,南瓜奶油汤,玉米浓汤,番茄浓汤,冬瓜虾仁汤,白萝卜汤,山药木耳汤,银耳莲子羹,雪梨银耳羹,红豆汤,绿豆汤,八宝粥,皮蛋瘦肉粥,瘦肉粥,鸡肉粥,海鲜粥,艇仔粥,鱼片粥,南瓜小米粥,红枣银耳汤,木瓜银耳汤,莲藕汤,茶树菇鸡汤,竹荪鸡汤,虫草花鸡汤,山药枸杞鸡汤,当归羊肉汤,萝卜羊肉汤,羊肉汤,牛尾汤,番茄牛腩汤,酸辣汤,豆腐汤,鸡蛋汤,青菜豆腐汤,菠菜蛋汤,蘑菇汤,金针菇汤,海鲜酸辣汤,鱼头豆腐汤,木瓜鲫鱼汤,通草鲫鱼汤,花生猪蹄汤,黄豆猪蹄汤,猪蹄汤,排骨莲藕汤,排骨玉米汤,排骨山药汤,排骨海带汤,排骨萝卜汤,排骨苦瓜汤,排骨冬瓜汤,排骨菌菇汤,排骨土豆汤,排骨番茄汤,排骨芋头汤,排骨腐竹汤,一品锅,佛跳墙,瓦罐鸡汤,瓦罐排骨汤,瓦罐鸭汤,瓦罐鸽子汤,瓦罐牛肉汤,瓦罐素汤,瓦罐菌汤,瓦罐豆腐汤,瓦罐鱼汤,酸汤鱼,酸汤肥牛,胡辣汤,河南胡辣汤,逍遥胡辣汤,疙瘩汤,面疙瘩汤,鸡蛋疙瘩汤,紫菜虾皮汤,虾皮萝卜汤,虾皮冬瓜汤,榨菜肉丝汤,肉丝汤,豆腐肉丝汤,番茄豆腐汤,番茄蛋汤,菠菜豆腐汤,小白菜豆腐汤,金针菇豆腐汤,香菇豆腐汤,平菇汤,杏鲍菇汤,蟹味菇汤,白玉菇汤,杂菌汤,菌王汤,松茸汤,竹笙汤,发菜汤,发菜蚝豉汤,西洋菜蜜枣汤,菜干猪肺汤,霸王花猪骨汤,南北杏猪肺汤,无花果瘦肉汤,苹果瘦肉汤,雪梨瘦肉汤,海底椰鸡汤,椰子乌鸡汤,清补凉汤,五指毛桃汤,土茯苓汤,鸡骨草汤,老黄瓜汤,节瓜汤,佛手瓜汤,凉瓜排骨汤,苦瓜排骨汤,青萝卜汤,白萝卜牛腩汤,白萝卜羊肉汤,红萝卜玉米汤,马蹄甘蔗汤,竹蔗马蹄汤,茅根竹蔗水,夏枯草汤,西洋菜汤,菜干汤,蜜枣瘦肉汤,雪梨猪肺汤,霸王花汤,粉葛汤,赤小豆汤,薏米汤,冬瓜老鸭汤,酸萝卜老鸭汤,笋干老鸭汤,老鸭汤,鸭架汤,鸡汤,大骨汤,筒骨汤,骨头汤,排骨汤,牛肉汤,鱼汤,海鲜汤,素汤,蛋花汤,蔬菜汤,菌汤,瓜汤,根茎汤,甜汤,潮汕砂锅粥,皮蛋瘦肉粥,生滚粥,及第粥,滑鸡粥,瘦肉粥,鱼片粥,虾粥,蟹粥,鲍鱼粥,海参粥,五谷粥,燕麦粥,小米粥,南瓜粥,山药粥,红豆粥,绿豆粥,八宝粥,莲子粥,百合粥,黑米粥,紫米粥,薏米粥,玉米粥,地瓜粥,红薯粥,山药排骨粥,生菜粥,菠菜粥,鸡肉粥,鸭肉粥,牛肉粥,羊肉粥,海鲜粥,蔬菜粥,杂锦粥,状元及第粥,咸蛋瘦肉粥,瑶柱瘦肉粥,干贝瘦肉粥,鲍鱼鸡汤,花胶鸡汤,虫草花炖瘦肉,西洋参鸡汤,党参鸡汤,冬阴功汤,椰汁西米露,芒果西米露,法式洋葱汤,蘑菇浓汤,番茄海鲜汤,蛤蜊浓汤,玉米奶油汤,南瓜奶油汤,罗宋汤,奶油蘑菇汤,泰式椰奶汤,海鲜酸辣汤,东北大骨头汤,酸菜白肉汤",
  };

  /* 菜系关键词标注（菜名包含其一即归该菜系，取首个命中） */
  var CUISINE_RULES = [
    ['sichuan', ['麻婆','水煮','鱼香','宫保','回锅','夫妻','辣子','毛血旺','酸菜鱼','泡椒','藤椒','麻辣','干锅','川']],
    ['hunan', ['剁椒','腊','尖椒炒肉','东安','永州','湘','烟笋','擂辣椒','腊肉']],
    ['guangdong', ['白切','盐焗','叉烧','老火','清蒸','上汤','艇仔','广东','烧腊','蜜汁','豉汁','清补凉','椰子鸡','菜干','霸王花','南北杏','无花果','苹果瘦肉','雪梨','海底椰','五指毛桃','鸡骨草','土茯苓','瓦罐','佛跳墙','冬瓜老鸭','老鸭','西洋菜','粉葛','赤小豆','瑶柱','花胶','西洋参','党参','虫草花炖']],
    ['thai', ['冬阴','咖喱','芒果糯','柠檬','泰式','椰香','青柠','香茅','罗勒','菠萝咕','菠萝','西米','椰汁']],
    ['western', ['提拉米苏','意式','凯撒','牛排','芝士','奶油','西式','三文鱼','沙拉','戚风','曲奇','香蕉面包','吐司','披萨','汉堡','三明治','松饼','奶昔','焗','烤鸡','薯','罗宋']],
    ['dongbei', ['锅包','地三鲜','猪肉炖粉条','杀猪菜','酸菜白肉','溜肉段','东北乱炖','酱骨头','烤冷面','铁锅炖','大拉皮','小鸡炖蘑菇','得莫利','李连贵','东北春饼','酸菜血肠','熘肥肠','雪衣豆沙','东北酱茄子','尖椒干豆腐','酸菜粉','蒜茄子','东北大骨头','酸菜白肉汤']]
  ];
  function cuisineOf(name) {
    for (var i = 0; i < CUISINE_RULES.length; i++) {
      var kw = CUISINE_RULES[i][1];
      for (var j = 0; j < kw.length; j++) if (name.indexOf(kw[j]) > -1) return CUISINE_RULES[i][0];
    }
    return null;
  }
  function slug(s) { return String(s).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ''); }

  function ingFor(name, type) {
    var main = name.replace(/[煮炖烧炒蒸烤拌爆煎焖炸卤蜜照铁板手撕怪味棒棒钵钵魔芋柠檬香茅菠萝橙汁金沙咸蛋黄南乳京都为]+/g, '').slice(0, 5) || '主料';
    var base = [main, '葱姜蒜', '食用油', '盐', '生抽'];
    if (type === 'meat') base.push('料酒', '老抽', '糖');
    else if (type === 'veg') base.push('蚝油');
    else base.push('清水', '姜片', '香油');
    return base.slice(0, 8);
  }
  function stepsFor(name, type) {
    if (type === 'meat') return ['主料洗净切块，用料酒生抽腌10分钟去腥', '热锅下油，爆香葱姜蒜', '下主料大火翻炒上色', '加生抽老抽糖与适量热水', '加盖中小火焖煮入味，大火收汁出锅'];
    if (type === 'veg') return ['蔬菜洗净切好，部分食材焯水备用', '热锅少油，爆香蒜末', '下蔬菜大火快速翻炒', '加盐与少许蚝油调味，出锅'];
    return ['食材处理干净备用', '锅中加足量清水与姜片', '大火烧开撇去浮沫，转小火慢煲', '煲至食材软烂，加盐调味', '出锅前撒葱花淋香油'];
  }

  function buildAllDishes() {
    var out = [];
    Object.keys(SEED).forEach(function (type) {
      SEED[type].split(',').forEach(function (raw) {
        var name = raw.trim(); if (!name) return;
        var id = 'd-' + slug(name);
        for (var k = 0; k < out.length; k++) if (out[k].id === id) return; // 去重
        var cats = [type];
        var cu = cuisineOf(name); if (cu) cats.push(cu);
        if (/凉拌|沙拉/.test(name)) cats.push('cold');
        if (/烘焙|蛋糕|饼干|面包|吐司/.test(name)) cats.push('baking');
        if (/粥/.test(name)) cats.push('breakfast');
        if (/鸡|鸭|鸽|鹌鹑|禽/.test(name) && !/素|豆腐|蔬/.test(name)) cats.push('poultry');
        if (/虾|蟹|鱿鱼|扇贝|海参|花蛤|蛤蜊|蛏|带鱼|鳕|石斑|龙利|多宝|鲈|鲳|草鱼|鲫鱼|黄鱼|桂鱼|鳜|鲍|瑶柱|干贝/.test(name)) cats.push('seafood');
        var hue = type === 'meat' ? (cu === 'thai' ? 35 : cu === 'western' ? 18 : 10) : type === 'veg' ? 125 : 35;
        out.push({ id: id, name: name, type: type, cats: cats, hue: hue, ingredients: ingFor(name, type), steps: stepsFor(name, type) });
      });
    });
    return out;
  }
  var RECIPES = buildAllDishes();

  /* 并入 菜单.docx 补充数据集（泰餐/西餐/川菜/湘菜/东北菜/烘焙） */
  (function () {
    var extra = window.__EXTRA_RECIPES__ || [];
    var seen = {};
    RECIPES.forEach(function (d) { seen[d.id] = 1; });
    extra.forEach(function (d) {
      if (seen[d.id]) {
        // 同名碰撞：把文档版的菜系/标签合并进内置版，避免丢失分类
        for (var i = 0; i < RECIPES.length; i++) {
          if (RECIPES[i].id === d.id) {
            d.cats.forEach(function (c) { if (RECIPES[i].cats.indexOf(c) < 0) RECIPES[i].cats.push(c); });
            break;
          }
        }
        return;
      }
      seen[d.id] = 1;
      d.ingredients = ingFor(d.name, d.type);
      d.steps = stepsFor(d.name, d.type);
      RECIPES.push(d);
    });
  })();

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
    sel.appendChild(U.el('option', { value: 'all', text: '全部菜品（' + RECIPES.length + '）' }));
    CATS.forEach(function (g) {
      var og = U.el('optgroup', { label: g.group });
      g.items.forEach(function (it) {
        var n = RECIPES.filter(function (d) { return (d.cats || []).indexOf(it.id) > -1; }).length;
        og.appendChild(U.el('option', { value: it.id, text: it.name + '（' + n + '）' }));
      });
      sel.appendChild(og);
    });
    catsCard.appendChild(sel);
    var grid = U.el('div', { class: 'grid c3' });
    catsCard.appendChild(grid);
    root.appendChild(catsCard);
    renderGrid('all', grid);

    /* ===== 今日吃什么 · 三个独立转盘 ===== */
    var wheelSection = U.el('div', { id: 'sec-wheel' });
    wheelSection.appendChild(U.el('div', { class: 'card-title', style: 'margin:14px 0 6px', text: '🎯 今日吃什么' }));
    wheelSection.appendChild(U.el('div', { class: 'muted', style: 'margin-bottom:10px', text: '三个转盘分别转肉菜 / 青菜 / 汤，每个可多次多选预选；已被预选的菜不会再被抽到。最后一键生成做菜指南。' }));

    var wheelCard = U.el('div', { class: 'card' });
    var preBox = U.el('div', { class: 'row wrap', id: 'preselectBox' });

    function addPreselect(id) { var a = getPreselect(); if (a.indexOf(id) > -1) return false; a.push(id); setPreselect(a); return true; }
    function removePre(id) { setPreselect(getPreselect().filter(function (x) { return x !== id; })); }

    // 通用转盘构造
    function makeWheel(type, label, hue) {
      var pool = RECIPES.filter(function (d) { return d.type === type; });
      var sub = U.el('div', { style: 'border-top:1px solid var(--line);padding-top:12px;margin-top:12px' });
      var titleEl = U.el('div', { class: 'card-sub', text: label + '（池中 ' + pool.length + ' 道 · 已抽 ' + countSelected(pool) + '）' });
      sub.appendChild(titleEl);
      var wrap = U.el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:10px' });
      var box = U.el('div', { style: 'position:relative;width:200px;height:200px' });
      box.innerHTML = buildWheelSVG(pool, hue);
      wrap.appendChild(box);
      var rotG = box.querySelector('.wheelRot');
      if (rotG) { rotG.style.transformBox = 'view-box'; rotG.style.transformOrigin = '100px 100px'; }
      var resultBox = U.el('div', { style: 'min-height:18px;text-align:center' });
      wrap.appendChild(resultBox);
      var spinBtn = U.el('button', { class: 'btn sm', text: '开始转动', onclick: function () { spin(); } });
      wrap.appendChild(spinBtn);
      var preList = U.el('div', { class: 'row wrap', style: 'margin-top:6px;justify-content:center' });
      wrap.appendChild(preList);
      sub.appendChild(wrap);
      wheelCard.appendChild(sub);

      var wheelRot = 0, spinning = false;
      function avail() { var sel = getPreselect(); return pool.filter(function (d) { return sel.indexOf(d.id) < 0; }); }
      function renderPre() {
        U.clear(preList);
        var sel = getPreselect();
        titleEl.textContent = label + '（池中 ' + pool.length + ' 道 · 已抽 ' + countSelected(pool) + '）';
        var any = false;
        pool.forEach(function (d) {
          if (sel.indexOf(d.id) > -1) {
            any = true;
            preList.appendChild(U.el('span', { class: 'tag removable', text: d.name, onclick: function () { removePre(d.id); renderPre(); renderGlobalPre(); refreshCounts(); } }));
          }
        });
        if (!any) preList.appendChild(U.el('span', { class: 'muted', text: '（尚未预选）' }));
      }
      function spin() {
        if (spinning) return;
        var a = avail();
        if (!a.length) { U.toast(label + ' 已抽完，可移除部分再抽'); spinning = false; return; }
        spinning = true;
        var N = a.length, step = 360 / N, idx = Math.floor(Math.random() * N);
        var desired = (360 - (idx * step + step / 2)) % 360;
        var curMod = ((wheelRot % 360) + 360) % 360;
        var delta = (desired - curMod + 360) % 360;
        wheelRot += 360 * 5 + delta;
        rotG.style.transition = 'transform 4s cubic-bezier(.17,.67,.3,1.15)';
        rotG.style.transform = 'rotate(' + wheelRot + 'deg)';
        U.clear(resultBox); resultBox.appendChild(U.el('div', { class: 'muted', text: '转动中…' }));
        setTimeout(function () {
          spinning = false;
          var d = a[idx];
          U.clear(resultBox);
          var line = U.el('div', { style: 'font-weight:800;font-size:16px' });
          line.appendChild(U.el('span', { text: '转到：' }));
          line.appendChild(U.el('span', { style: 'color:var(--brand)', text: d.name }));
          resultBox.appendChild(line);
          resultBox.appendChild(U.el('button', { class: 'btn sm', style: 'margin-top:6px', text: '✓ 预选此菜', onclick: function () {
            if (addPreselect(d.id)) { U.toast('已预选：' + d.name); } else { U.toast('已在预选中'); }
            renderPre(); renderGlobalPre(); refreshCounts();
          } }));
        }, 4100);
      }
      renderPre();
      return { pool: pool, renderPre: renderPre };
    }
    function countSelected(pool) { var sel = getPreselect(); return pool.filter(function (d) { return sel.indexOf(d.id) > -1; }).length; }
    var wheels = [
      makeWheel('meat', '🍖 肉菜转盘', 8),
      makeWheel('veg', '🥬 青菜转盘', 125),
      makeWheel('soup', '🍲 汤转盘', 35)
    ];
    function refreshCounts() {
      wheels.forEach(function (w) {
        // 更新每个转盘标题里的“已抽”数
      });
    }
    wheelSection.appendChild(wheelCard);

    // 总预选区
    wheelCard.appendChild(U.el('div', { class: 'card-sub', style: 'margin:14px 0 6px;border-top:1px solid var(--line);padding-top:12px', text: '🧺 预选清单（共 ' + getPreselect().length + ' 道）' }));
    wheelCard.appendChild(preBox);
    function renderGlobalPre() {
      U.clear(preBox);
      var arr = getPreselect();
      wheelCard.querySelector('.card-sub').textContent = '🧺 预选清单（共 ' + arr.length + ' 道）';
      if (!arr.length) { preBox.appendChild(U.el('span', { class: 'muted', text: '还没有预选，去上面三个转盘转一转吧～' })); return; }
      arr.forEach(function (id) {
        var d = findDish(id); if (!d) return;
        preBox.appendChild(U.el('span', { class: 'tag removable', text: (d.type === 'meat' ? '🍖' : d.type === 'veg' ? '🥬' : '🍲') + d.name, onclick: function () { removePre(id); renderGlobalPre(); wheels.forEach(function (w) { w.renderPre(); }); refreshCounts(); } }));
      });
    }
    var genBtn = U.el('button', { class: 'btn ghost sm', style: 'margin-top:10px', text: '📋 一键生成做菜指南', onclick: function () { generateGuide(); } });
    wheelCard.appendChild(genBtn);
    root.appendChild(wheelSection);
    renderGlobalPre();

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

    /* ---------- 渲染函数 ---------- */
    function renderGrid(catId, gridEl) {
      U.clear(gridEl);
      var list = RECIPES.concat(getImported());
      if (catId && catId !== 'all') list = list.filter(function (d) { return (d.cats || []).indexOf(catId) > -1; });
      if (!list.length) { gridEl.appendChild(U.el('div', { class: 'empty', text: '该分类暂无菜品' })); return; }
      list.forEach(function (d) {
        var card = U.el('div', { class: 'dish-card', onclick: function () { showDish(d); } });
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
      if (d.image) body.appendChild(U.el('img', { src: d.image, style: 'width:100%;border-radius:12px;margin-bottom:12px;background:var(--surface-3)' }));
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
          { label: '加入预选', primary: true, onClick: function () { if (addPreselect(d.id)) { U.toast('已加入预选'); } else { U.toast('已在预选中'); } renderGlobalPre(); wheels.forEach(function (w) { w.renderPre(); }); } },
          { label: '关闭', onClick: function () {} }
        ]
      });
    }

    function generateGuide() {
      var arr = getPreselect();
      if (!arr.length) { U.toast('请先预选至少一道菜'); return; }
      var dishes = arr.map(findDish).filter(Boolean);
      var groups = [['meat', '🍖 肉菜'], ['veg', '🥬 青菜'], ['soup', '🍲 汤'], ['other', '📎 其他']];
      var body = U.el('div');
      var actions = U.el('div', { class: 'row', style: 'margin-bottom:10px' });
      actions.appendChild(U.el('button', { class: 'btn sm', text: '📋 复制全文', onclick: function () { copyText(buildGuideText(dishes)); } }));
      actions.appendChild(U.el('button', { class: 'btn ghost sm', text: '⬇ 下载TXT', onclick: function () { U.download('做菜指南_' + S.todayStr() + '.txt', buildGuideText(dishes), 'text/plain;charset=utf-8'); } }));
      actions.appendChild(U.el('button', { class: 'btn ghost sm', text: '⭐ 存到灵感', onclick: function () { saveToInspiration(dishes); } }));
      body.appendChild(actions);
      groups.forEach(function (g) {
        var list = dishes.filter(function (d) { return g[0] === 'other' ? (d.type !== 'meat' && d.type !== 'veg' && d.type !== 'soup') : d.type === g[0]; });
        if (!list.length) return;
        body.appendChild(U.el('div', { style: 'font-weight:800;font-size:15px;margin:14px 0 6px;border-top:1px solid var(--line);padding-top:10px', text: g[1] + '（' + list.length + '）' }));
        list.forEach(function (d, i) {
          body.appendChild(U.el('div', { style: 'font-weight:700;font-size:14px;margin:8px 0 4px', text: (i + 1) + '. ' + d.name }));
          if (d.image) body.appendChild(U.el('img', { src: d.image, style: 'width:100%;border-radius:10px;margin-bottom:8px;background:var(--surface-3)' }));
          if (d.ingredients && d.ingredients.length) body.appendChild(U.el('div', { class: 'muted', style: 'font-size:13px', text: '食材：' + d.ingredients.join('、') }));
          if (d.steps && d.steps.length) {
            d.steps.forEach(function (s, k) { body.appendChild(U.el('div', { style: 'margin:3px 0', text: (k + 1) + ') ' + s })); });
          } else if (d.text) {
            body.appendChild(U.el('div', { style: 'white-space:pre-wrap;line-height:1.6', text: d.text }));
          }
          if (d.sourceUrl) body.appendChild(U.el('a', { class: 'muted', style: 'font-size:12px;display:block;margin-top:4px', href: d.sourceUrl, target: '_blank', rel: 'noopener', text: '🔗 原链接' }));
        });
      });
      U.modal({ title: '今日做菜指南', body: body, actions: [{ label: '关闭', primary: true, onClick: function () {} }] });
    }

    function buildGuideText(dishes) {
      var head = '今日做菜指南（生成于 ' + S.todayStr() + ' ' + U.fmtTime(new Date()) + '）\n' + '='.repeat(24) + '\n';
      var groups = [['meat', '肉菜'], ['veg', '青菜'], ['soup', '汤'], ['other', '其他']];
      var parts = groups.map(function (g) {
        var list = dishes.filter(function (d) { return g[0] === 'other' ? (d.type !== 'meat' && d.type !== 'veg' && d.type !== 'soup') : d.type === g[0]; });
        if (!list.length) return '';
        var block = '【' + g[1] + '】\n' + list.map(function (d, i) {
          var lines = [(i + 1) + '. ' + d.name];
          if (d.ingredients && d.ingredients.length) lines.push('  食材：' + d.ingredients.join('、'));
          if (d.steps && d.steps.length) lines.push('  做法：\n' + d.steps.map(function (s, k) { return '    ' + (k + 1) + ') ' + s; }).join('\n'));
          else if (d.text) lines.push('  原文：\n' + d.text);
          if (d.sourceUrl) lines.push('  原链接：' + d.sourceUrl);
          return lines.join('\n');
        }).join('\n');
        return block;
      }).filter(Boolean);
      return head + parts.join('\n' + '-'.repeat(24) + '\n');
    }

    function copyText(t) {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { U.toast('已复制全文'); }, function () { fallbackCopy(t); });
      else fallbackCopy(t);
    }
    function fallbackCopy(t) {
      try { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); U.toast('已复制全文'); } catch (e) { U.toast('复制失败，请手动选择'); }
    }

    function saveToInspiration(dishes) {
      try {
        var arr = S.getInspirations ? S.getInspirations() : [];
        var d = new Date();
        arr.unshift({
          id: U.uid(), content: buildGuideText(dishes), tags: ['菜谱', '做菜指南'],
          date: S.todayStr(), time: U.fmtTime(d), pinned: false, starred: false, attachments: []
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
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url }) }).then(function (resp) { return resp.json(); }).then(function (r) {
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

  /* ---------- 转盘 SVG 构建（接收菜品池） ---------- */
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
  function buildWheelSVG(pool, hue) {
    var N = pool.length, step = 360 / N;
    var s = "<svg viewBox='0 0 200 200' width='200' height='200'>";
    s += "<g class='wheelRot'>";
    for (var i = 0; i < N; i++) {
      var a0 = i * step, a1 = (i + 1) * step;
      var light = 32 + (i % 3) * 9;
      s += "<path d='" + sectorPath(100, 100, 95, a0, a1) + "' fill='hsl(" + hue + ',55%,' + light + "%)' stroke='#fff' stroke-width='1'/>";
      var mid = a0 + step / 2, pos = polar(100, 100, 62, mid), nm = pool[i].name;
      if (nm.length > 4) nm = nm.slice(0, 4) + '…';
      s += "<text x='" + pos.x.toFixed(1) + "' y='" + pos.y.toFixed(1) + "' transform='rotate(" + mid + ' ' + pos.x.toFixed(1) + ' ' + pos.y.toFixed(1) + ")' font-size='8' fill='#fff' text-anchor='middle' dominant-baseline='middle'>" + nm + '</text>';
    }
    s += "</g>";
    s += "<circle cx='100' cy='100' r='14' fill='#fff' stroke='#e8ecf4' stroke-width='2'/>";
    s += "<path d='M100 4 L93 20 L107 20 Z' fill='#ef4848'/>";
    s += "</svg>";
    return s;
  }
})();
