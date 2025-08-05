import { ExtendedCoffeeBean, BeanType, ViewOption, BloggerBeansYear, BeanFilterMode, BloggerType } from './types';
import { getBooleanState, saveBooleanState, getStringState, saveStringState, getNumberState, saveNumberState } from '@/lib/core/statePersistence';
import { SortOption } from './SortSelector';
import { FlavorPeriodStatus } from '@/lib/utils/beanVarietyUtils';

// 模块名称
const MODULE_NAME = 'coffee-beans';

// 创建全局缓存对象，确保跨组件实例保持数据
export const globalCache: {
    beans: ExtendedCoffeeBean[];
    ratedBeans: ExtendedCoffeeBean[];
    filteredBeans: ExtendedCoffeeBean[];
    bloggerBeans: {
        2023: ExtendedCoffeeBean[];
        2024: ExtendedCoffeeBean[];
        2025: ExtendedCoffeeBean[];
    };
    varieties: string[];
    selectedVariety: string | null;
    selectedBeanType: BeanType;
    // 新增分类相关状态
    filterMode: BeanFilterMode;
    selectedOrigin: string | null;
    selectedFlavorPeriod: FlavorPeriodStatus | null;
    selectedRoaster: string | null;
    availableOrigins: string[];
    availableFlavorPeriods: FlavorPeriodStatus[];
    availableRoasters: string[];
    showEmptyBeans: boolean;
    viewMode: ViewOption;
    sortOption: SortOption;
    // 为每个视图模式添加独立的排序选项
    inventorySortOption: SortOption;
    rankingSortOption: SortOption;
    bloggerSortOption: SortOption;
    rankingBeanType: BeanType;
    rankingEditMode: boolean;
    bloggerYear: BloggerBeansYear; // 保留用于向后兼容
    bloggerType: BloggerType;
    // 每个博主的年份记忆
    bloggerYears: {
        peter: BloggerBeansYear;
        fenix: BloggerBeansYear;
    };
    initialized: boolean;
} = {
    beans: [],
    ratedBeans: [],
    filteredBeans: [],
    bloggerBeans: { 2023: [], 2024: [], 2025: [] }, // 初始化三年的博主榜单
    varieties: [],
    selectedVariety: null,
    selectedBeanType: 'all',
    // 新增分类相关状态初始值
    filterMode: 'variety',
    selectedOrigin: null,
    selectedFlavorPeriod: null,
    selectedRoaster: null,
    availableOrigins: [],
    availableFlavorPeriods: [],
    availableRoasters: [],
    showEmptyBeans: false,
    viewMode: 'inventory',
    sortOption: 'remaining_days_asc',
    // 为每个视图模式设置默认排序选项
    inventorySortOption: 'remaining_days_asc',
    rankingSortOption: 'rating_desc',
    bloggerSortOption: 'original',
    rankingBeanType: 'all',
    rankingEditMode: false,
    bloggerYear: 2025, // 保留用于向后兼容
    bloggerType: 'peter',
    // 每个博主的默认年份
    bloggerYears: {
        peter: 2025,
        fenix: 2025, // 矮人博主默认2025年
    },
    initialized: false
};

// 从localStorage读取已用完状态的函数
export const getShowEmptyBeansPreference = (): boolean => {
    return getBooleanState(MODULE_NAME, 'showEmptyBeans', false);
};

// 保存已用完状态到localStorage的函数
export const saveShowEmptyBeansPreference = (value: boolean): void => {
    saveBooleanState(MODULE_NAME, 'showEmptyBeans', value);
};

// 从localStorage读取选中的品种
export const getSelectedVarietyPreference = (): string | null => {
    const value = getStringState(MODULE_NAME, 'selectedVariety', '');
    return value === '' ? null : value;
};

// 保存选中的品种到localStorage
export const saveSelectedVarietyPreference = (value: string | null): void => {
    saveStringState(MODULE_NAME, 'selectedVariety', value || '');
};

// 从localStorage读取选中的豆子类型
export const getSelectedBeanTypePreference = (): BeanType => {
    const value = getStringState(MODULE_NAME, 'selectedBeanType', 'all');
    return value as BeanType;
};

// 保存选中的豆子类型到localStorage
export const saveSelectedBeanTypePreference = (value: BeanType): void => {
    saveStringState(MODULE_NAME, 'selectedBeanType', value);
};

// 从localStorage读取视图模式
export const getViewModePreference = (): ViewOption => {
    const value = getStringState(MODULE_NAME, 'viewMode', 'inventory');
    return value as ViewOption;
};

// 保存视图模式到localStorage
export const saveViewModePreference = (value: ViewOption): void => {
    saveStringState(MODULE_NAME, 'viewMode', value);
};

// 从localStorage读取排序选项（全局）
export const getSortOptionPreference = (): SortOption => {
    const value = getStringState(MODULE_NAME, 'sortOption', 'remaining_days_asc');
    return value as SortOption;
};

// 保存排序选项到localStorage（全局）
export const saveSortOptionPreference = (value: SortOption): void => {
    saveStringState(MODULE_NAME, 'sortOption', value);
};

// 从localStorage读取库存视图排序选项
export const getInventorySortOptionPreference = (): SortOption => {
    const value = getStringState(MODULE_NAME, 'inventorySortOption', 'remaining_days_asc');
    return value as SortOption;
};

// 保存库存视图排序选项到localStorage
export const saveInventorySortOptionPreference = (value: SortOption): void => {
    saveStringState(MODULE_NAME, 'inventorySortOption', value);
};

// 从localStorage读取个人榜单视图排序选项
export const getRankingSortOptionPreference = (): SortOption => {
    const value = getStringState(MODULE_NAME, 'rankingSortOption', 'rating_desc');
    return value as SortOption;
};

// 保存个人榜单视图排序选项到localStorage
export const saveRankingSortOptionPreference = (value: SortOption): void => {
    saveStringState(MODULE_NAME, 'rankingSortOption', value);
};

// 从localStorage读取博主榜单视图排序选项
export const getBloggerSortOptionPreference = (): SortOption => {
    const value = getStringState(MODULE_NAME, 'bloggerSortOption', 'original');
    return value as SortOption;
};

// 保存博主榜单视图排序选项到localStorage
export const saveBloggerSortOptionPreference = (value: SortOption): void => {
    saveStringState(MODULE_NAME, 'bloggerSortOption', value);
};

// 从localStorage读取榜单豆子类型
export const getRankingBeanTypePreference = (): BeanType => {
    const value = getStringState(MODULE_NAME, 'rankingBeanType', 'all');
    return value as BeanType;
};

// 保存榜单豆子类型到localStorage
export const saveRankingBeanTypePreference = (value: BeanType): void => {
    saveStringState(MODULE_NAME, 'rankingBeanType', value);
};

// 从localStorage读取榜单编辑模式
export const getRankingEditModePreference = (): boolean => {
    return getBooleanState(MODULE_NAME, 'rankingEditMode', false);
};

// 保存榜单编辑模式到localStorage
export const saveRankingEditModePreference = (value: boolean): void => {
    saveBooleanState(MODULE_NAME, 'rankingEditMode', value);
};

// 从localStorage读取博主榜单年份
export const getBloggerYearPreference = (): BloggerBeansYear => {
    const value = getNumberState(MODULE_NAME, 'bloggerYear', 2025);
    return value as BloggerBeansYear;
};

// 保存博主榜单年份到localStorage
export const saveBloggerYearPreference = (value: BloggerBeansYear): void => {
    saveNumberState(MODULE_NAME, 'bloggerYear', value);
};

// 从localStorage读取博主类型
export const getBloggerTypePreference = (): BloggerType => {
    const value = getStringState(MODULE_NAME, 'bloggerType', 'peter');
    return value as BloggerType;
};

// 保存博主类型到localStorage
export const saveBloggerTypePreference = (value: BloggerType): void => {
    saveStringState(MODULE_NAME, 'bloggerType', value);
};

// 从localStorage读取博主年份记忆
export const getBloggerYearMemory = (blogger: BloggerType): BloggerBeansYear => {
    const key = `bloggerYear_${blogger}`;
    const defaultYear = blogger === 'peter' ? 2025 : 2025; // fenix也默认为2025
    const value = getNumberState(MODULE_NAME, key, defaultYear);

    // 验证年份是否有效
    const validYears = blogger === 'peter' ? [2024, 2025] : [2023, 2024, 2025];
    if (validYears.includes(value)) {
        return value as BloggerBeansYear;
    }

    // 如果无效，返回默认年份
    return defaultYear as BloggerBeansYear;
};

// 保存博主年份记忆到localStorage
export const saveBloggerYearMemory = (blogger: BloggerType, year: BloggerBeansYear): void => {
    // 验证年份是否有效
    const validYears = blogger === 'peter' ? [2024, 2025] : [2023, 2024, 2025];
    if (!validYears.includes(year)) {
        console.warn(`Invalid year ${year} for blogger ${blogger}, not saving`);
        return;
    }

    const key = `bloggerYear_${blogger}`;
    saveNumberState(MODULE_NAME, key, year);
};

// 初始化globalCache中的博主相关设置
export const initializeBloggerPreferences = (): void => {
    // 从localStorage加载博主类型
    const savedBloggerType = getBloggerTypePreference();
    globalCache.bloggerType = savedBloggerType;

    // 从localStorage加载各博主的年份记忆
    globalCache.bloggerYears.peter = getBloggerYearMemory('peter');
    globalCache.bloggerYears.fenix = getBloggerYearMemory('fenix');
};

// 从localStorage读取分类模式
export const getFilterModePreference = (): BeanFilterMode => {
    const value = getStringState(MODULE_NAME, 'filterMode', 'variety');
    return value as BeanFilterMode;
};

// 保存分类模式到localStorage
export const saveFilterModePreference = (value: BeanFilterMode): void => {
    saveStringState(MODULE_NAME, 'filterMode', value);
};

// 从localStorage读取选中的产地
export const getSelectedOriginPreference = (): string | null => {
    const value = getStringState(MODULE_NAME, 'selectedOrigin', '');
    return value === '' ? null : value;
};

// 保存选中的产地到localStorage
export const saveSelectedOriginPreference = (value: string | null): void => {
    saveStringState(MODULE_NAME, 'selectedOrigin', value || '');
};

// 从localStorage读取选中的赏味期状态
export const getSelectedFlavorPeriodPreference = (): FlavorPeriodStatus | null => {
    const value = getStringState(MODULE_NAME, 'selectedFlavorPeriod', '');
    return value === '' ? null : (value as FlavorPeriodStatus);
};

// 保存选中的赏味期状态到localStorage
export const saveSelectedFlavorPeriodPreference = (value: FlavorPeriodStatus | null): void => {
    saveStringState(MODULE_NAME, 'selectedFlavorPeriod', value || '');
};

// 从localStorage读取选中的烘焙商
export const getSelectedRoasterPreference = (): string | null => {
    const value = getStringState(MODULE_NAME, 'selectedRoaster', '');
    return value === '' ? null : value;
};

// 保存选中的烘焙商到localStorage
export const saveSelectedRoasterPreference = (value: string | null): void => {
    saveStringState(MODULE_NAME, 'selectedRoaster', value || '');
};

// 初始化全局缓存的状态
globalCache.showEmptyBeans = getShowEmptyBeansPreference();
globalCache.selectedVariety = getSelectedVarietyPreference();
globalCache.selectedBeanType = getSelectedBeanTypePreference();
globalCache.viewMode = getViewModePreference();
globalCache.sortOption = getSortOptionPreference();
globalCache.inventorySortOption = getInventorySortOptionPreference();
globalCache.rankingSortOption = getRankingSortOptionPreference();
globalCache.bloggerSortOption = getBloggerSortOptionPreference();
globalCache.rankingBeanType = getRankingBeanTypePreference();
globalCache.rankingEditMode = getRankingEditModePreference();
globalCache.bloggerYear = getBloggerYearPreference();
// 初始化新增的分类相关状态
globalCache.filterMode = getFilterModePreference();
globalCache.selectedOrigin = getSelectedOriginPreference();
globalCache.selectedFlavorPeriod = getSelectedFlavorPeriodPreference();
globalCache.selectedRoaster = getSelectedRoasterPreference();

// 监听全局缓存重置事件
if (typeof window !== 'undefined') {
    window.addEventListener('globalCacheReset', () => {
        // 重置所有缓存数据到初始状态
        globalCache.beans = [];
        globalCache.ratedBeans = [];
        globalCache.filteredBeans = [];
        globalCache.bloggerBeans = { 2023: [], 2024: [], 2025: [] };
        globalCache.varieties = [];
        globalCache.selectedVariety = null;
        globalCache.selectedBeanType = 'all';
        // 重置新增的分类相关状态
        globalCache.filterMode = 'variety';
        globalCache.selectedOrigin = null;
        globalCache.selectedFlavorPeriod = null;
        globalCache.selectedRoaster = null;
        globalCache.availableOrigins = [];
        globalCache.availableFlavorPeriods = [];
        globalCache.availableRoasters = [];
        globalCache.showEmptyBeans = false;
        globalCache.viewMode = 'inventory';
        globalCache.sortOption = 'remaining_days_asc';
        globalCache.inventorySortOption = 'remaining_days_asc';
        globalCache.rankingSortOption = 'rating_desc';
        globalCache.bloggerSortOption = 'original';
        globalCache.rankingBeanType = 'all';
        globalCache.rankingEditMode = false;
        globalCache.bloggerYear = 2025;
        globalCache.initialized = false;

        console.warn('咖啡豆全局缓存已重置');
    });
}

// 检查咖啡豆是否用完
export const isBeanEmpty = (bean: ExtendedCoffeeBean): boolean => {
    // 如果没有capacity属性，视为非空
    if (bean.capacity === undefined || bean.capacity === null) return false;

    // 如果没有remaining属性，视为非空
    if (bean.remaining === undefined || bean.remaining === null) return false;

    // 处理remaining可能是字符串或数字的情况
    let remainingValue: number;
    if (typeof bean.remaining === 'number') {
        remainingValue = bean.remaining;
    } else {
        // 移除所有非数字字符（除了小数点和负号）
        const cleanedRemaining = bean.remaining.toString().replace(/[^\d.-]/g, '');
        remainingValue = parseFloat(cleanedRemaining);
    }

    // 当数值为0或接近0时视为空（浮点数比较）
    return !isNaN(remainingValue) && remainingValue < 0.001;
};

// 获取咖啡豆的赏味期信息
export const getFlavorInfo = (bean: ExtendedCoffeeBean): { phase: string, remainingDays: number } => {
    // 处理在途状态
    if (bean.isInTransit) {
        return { phase: '在途', remainingDays: 0 };
    }

    if (!bean.roastDate) {
        return { phase: '衰退期', remainingDays: 0 };
    }

    // 计算天数差
    const today = new Date();
    const roastDate = new Date(bean.roastDate);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate());
    const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24));

    // 优先使用自定义赏味期参数，如果没有则根据烘焙度计算
    let startDay = bean.startDay || 0;
    let endDay = bean.endDay || 0;

    // 如果没有自定义值，则根据烘焙度设置默认值
    if (startDay === 0 && endDay === 0) {
        if (bean.roastLevel?.includes('浅')) {
            startDay = 7;
            endDay = 30;
        } else if (bean.roastLevel?.includes('深')) {
            startDay = 14;
            endDay = 60;
        } else {
            // 默认为中烘焙
            startDay = 10;
            endDay = 30;
        }
    }

    let phase = '';
    let remainingDays = 0;
    
    if (daysSinceRoast < startDay) {
        phase = '养豆期';
        remainingDays = startDay - daysSinceRoast;
    } else if (daysSinceRoast <= endDay) {
        phase = '赏味期';
        remainingDays = endDay - daysSinceRoast;
    } else {
        phase = '衰退期';
        remainingDays = 0;
    }

    return { phase, remainingDays };
}; 