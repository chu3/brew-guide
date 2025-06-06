import { CoffeeBean } from '@/types/app'
import { getBeanOrigins, getBeanProcesses, getBeanVarieties } from '@/lib/utils/beanVarietyUtils'

// 添加BlendComponent类型
export interface BlendComponent {
    percentage?: number;  // 百分比 (1-100)，改为可选
    origin?: string;     // 产地
    process?: string;    // 处理法
    variety?: string;    // 品种
}

// 确保 ExtendedCoffeeBean 包含 isFrozen 字段
// 扩展CoffeeBean类型
export interface ExtendedCoffeeBean extends CoffeeBean {
    blendComponents?: BlendComponent[];
    isFrozen?: boolean;  // 显式添加冰冻状态字段，确保类型定义完整
    isInTransit?: boolean; // 显式添加在途状态字段，确保类型定义完整
}

// 视图模式定义
export const VIEW_OPTIONS = {
    INVENTORY: 'inventory',
    RANKING: 'ranking',
    BLOGGER: 'blogger', // 新增博主榜单视图
    STATS: 'stats', // 新增统计视图
} as const;

export type ViewOption = typeof VIEW_OPTIONS[keyof typeof VIEW_OPTIONS];

// 视图选项的显示名称 - 已移至翻译文件，使用 nav.views 命名空间
// 这个常量保留用于类型检查，实际显示文本请使用 useTranslations('nav') 获取
export const VIEW_LABELS: Record<ViewOption, string> = {
    [VIEW_OPTIONS.INVENTORY]: 'nav.views.inventory',
    [VIEW_OPTIONS.RANKING]: 'nav.views.ranking',
    [VIEW_OPTIONS.BLOGGER]: 'nav.views.blogger',
    [VIEW_OPTIONS.STATS]: 'nav.views.stats',
};

export interface CoffeeBeansProps {
    isOpen: boolean
    showBeanForm?: (bean: ExtendedCoffeeBean | null) => void
    onShowImport?: () => void
    // 添加外部视图控制相关props
    externalViewMode?: ViewOption
    onExternalViewChange?: (view: ViewOption) => void
}

// 导出工具函数
export const generateBeanTitle = (bean: ExtendedCoffeeBean, showOnlyName: boolean = false): string => {
    // 安全检查：确保bean是有效对象且有名称
    if (!bean || typeof bean !== 'object' || !bean.name) {
        return bean?.name || '未命名咖啡豆';
    }

    // 如果只显示名称，直接返回名称
    if (showOnlyName) {
        return bean.name;
    }

    // 将豆子名称转换为小写以便比较
    const nameLower = bean.name.toLowerCase();

    // 创建一个函数来检查参数是否已包含在名称中
    const isIncluded = (param?: string | null): boolean => {
        // 如果参数为空或不是字符串类型，视为已包含
        if (!param || typeof param !== 'string') return true;

        // 将参数转换为小写并分割成单词
        const paramWords = param.toLowerCase().split(/\s+/);

        // 检查每个单词是否都包含在名称中
        return paramWords.every(word => nameLower.includes(word));
    };

    // 收集需要添加的参数
    const additionalParams: string[] = [];

    // 如果是拼配咖啡且有拼配成分，将成分添加到标题中
    if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
        // 拼配豆情况下，不再在标题中添加拼配成分信息
        if (bean.blendComponents.length > 1) {
            // 不添加拼配成分到标题
        } else {
            // 单品豆的情况，仍然添加信息到标题
            // 获取成分信息
            const comp = bean.blendComponents[0];
            if (comp) {
                // 检查并添加烘焙度
                if (bean.roastLevel && !isIncluded(bean.roastLevel)) {
                    additionalParams.push(bean.roastLevel);
                }
                
                // 检查并添加产地
                if (comp.origin && !isIncluded(comp.origin)) {
                    additionalParams.push(comp.origin);
                }
                
                // 检查并添加处理法
                if (comp.process && !isIncluded(comp.process)) {
                    additionalParams.push(comp.process);
                }
                
                // 检查并添加品种
                if (comp.variety && !isIncluded(comp.variety)) {
                    additionalParams.push(comp.variety);
                }
            }
        }
    } else {
        // 单品咖啡的情况，使用新的工具函数
        // 检查并添加烘焙度
        if (bean.roastLevel && !isIncluded(bean.roastLevel)) {
            additionalParams.push(bean.roastLevel);
        }

        // 使用工具函数获取产地信息
        const origins = getBeanOrigins(bean);
        origins.forEach(origin => {
            if (!isIncluded(origin)) {
                additionalParams.push(origin);
            }
        });

        // 使用工具函数获取处理法信息
        const processes = getBeanProcesses(bean);
        processes.forEach(process => {
            if (!isIncluded(process)) {
                additionalParams.push(process);
            }
        });

        // 使用工具函数获取品种信息
        const varieties = getBeanVarieties(bean);
        varieties.forEach(variety => {
            if (!isIncluded(variety)) {
                additionalParams.push(variety);
            }
        });
    }

    // 如果有额外参数，将它们添加到名称后面
    return additionalParams.length > 0
        ? `${bean.name} ${additionalParams.join(' ')}`
        : bean.name;
};

export type BloggerBeansYear = 2024 | 2025;
export type BeanType = 'all' | 'espresso' | 'filter'; 