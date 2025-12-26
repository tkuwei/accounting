
export const CLOUD_URL = "https://script.google.com/macros/s/AKfycbwXSauQ1RB-4CQUBHskHuHYmdTERDczNjG-qEhV-jK8ME7lb20ZVum_QW_aNwbEKOKb/exec";

export const CATEGORIES = {
    income: ['現金收入', 'FoodPanda', 'UberEats', '其他收入'],
    expense: {
        '日支出 (經常支出)': ['食材', '薪資 (日)', '雜項'],
        '月支出 (浮動支出)': ['米糧', '蔬菜', '火鍋料', '調味料', '耗材', 'FoodPanda', 'UberEats', '稅務', '維修'],
        '月支出 (固定支出)': ['租金', '水費', '電費', '瓦斯類', '電話費', '清潔維護費', '薪資 (月)']
    }
};

// Quick note presets based on selected category
export const NOTE_PRESETS: Record<string, string[]> = {
  '食材': ['豆腐鴨血', '臭豆腐', '蛤蜊', '洋蔥', '拉麵', '泡菜', '可樂', '冰淇淋'],
  '薪資 (日)': ['寶雲', '曹靜', '幫廚', '揚', '婷', '鈺'],
  '清潔維護費': ['地墊', '除蟲', '瓦斯爐'],
  '薪資 (月)': ['寶雲', '靜儀', '淑美', '雪紅', '惠華', '小惠']
};

export const STORAGE_KEY = 'snack_db_v12';