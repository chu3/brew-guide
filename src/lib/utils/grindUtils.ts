import { availableGrinders } from '../core/config';

// 定义自定义磨豆机类型（与Settings.tsx保持一致）
export interface CustomGrinder {
	id: string;
	name: string;
	grindSizes: Record<string, string>;
	isCustom: true;
}

/**
 * 解析研磨度字符串，提取磨豆机ID和研磨度值
 * 格式: "磨豆机ID:研磨度值" 或 "研磨度值"
 * @param grindSize 研磨度字符串
 * @returns { grinderId: 磨豆机ID或null, value: 研磨度值 }
 */
export function parseGrindSize(grindSize: string): { 
	grinderId: string | null; 
	value: string;
} {
	if (!grindSize) {
		return { grinderId: null, value: '' };
	}

	// 检查是否包含分隔符 ":"
	if (grindSize.includes(':')) {
		const parts = grindSize.split(':');
		if (parts.length >= 2) {
			const grinderId = parts[0].trim();
			const value = parts.slice(1).join(':').trim(); // 支持值中包含冒号
			return { grinderId: grinderId || null, value };
		}
	}

	// 旧格式或纯文本，没有磨豆机信息
	return { grinderId: null, value: grindSize };
}

/**
 * 组合磨豆机ID和研磨度值为存储格式
 * @param grinderId 磨豆机ID
 * @param value 研磨度值
 * @returns 组合后的字符串
 */
export function combineGrindSize(grinderId: string | null, value: string): string {
	if (!value) return '';
	
	// 如果是通用类型或没有磨豆机ID，直接返回值
	if (!grinderId || grinderId === 'generic') {
		return value;
	}

	// 组合为 "磨豆机ID:研磨度值"
	return `${grinderId}:${value}`;
}

/**
 * 获取磨豆机信息（包括自定义磨豆机）
 * @param grinderId 磨豆机ID
 * @param customGrinders 自定义磨豆机列表
 * @param fallbackToGeneric 当找不到磨豆机时是否降级到通用磨豆机（默认：false）
 * @returns 磨豆机对象或null
 */
export function findGrinder(
	grinderId: string | null, 
	customGrinders?: CustomGrinder[],
	fallbackToGeneric: boolean = false
): { id: string; name: string; grindSizes?: Record<string, string> } | null {
	if (!grinderId) return null;

	// 先在内置磨豆机中查找
	const builtInGrinder = availableGrinders.find(g => g.id === grinderId);
	if (builtInGrinder) {
		return builtInGrinder;
	}

	// 在自定义磨豆机中查找
	if (customGrinders) {
		const customGrinder = customGrinders.find(g => g.id === grinderId);
		if (customGrinder) {
			return {
				id: customGrinder.id,
				name: customGrinder.name,
				grindSizes: customGrinder.grindSizes
			};
		}
	}

	// 降级处理：如果磨豆机已被删除，返回通用磨豆机作为降级方案
	if (fallbackToGeneric) {
		console.warn(`磨豆机 ${grinderId} 不存在，使用通用磨豆机`);
		return {
			id: 'generic',
			name: '通用',
			grindSizes: {}
		};
	}

	return null;
}

/**
 * 判断磨豆机是否支持特定刻度（如"格"）
 * @param grinderId 磨豆机ID
 * @returns 是否支持特定刻度
 */
export function hasSpecificGrindScale(grinderId: string): boolean {
	if (grinderId === 'generic') return false;

	const grinder = availableGrinders.find(g => g.id === grinderId);
	return !!(grinder && grinder.grindSizes);
}

/**
 * 获取磨豆机的刻度单位（如"格"、"档"等）
 * @param grinderId 磨豆机ID
 * @returns 刻度单位，如果没有特定单位则返回空字符串
 */
export function getGrindScaleUnit(grinderId: string): string {
	if (grinderId === 'generic') return '';

	const grinder = availableGrinders.find(g => g.id === grinderId);
	if (!grinder || !grinder.grindSizes) return '';

	// 从研磨度映射中推断单位
	const values = Object.values(grinder.grindSizes);
	if (values.length > 0) {
		const firstValue = values[0];
		if (firstValue.includes('格')) return '格';
		if (firstValue.includes('档')) return '档';
		if (firstValue.includes('圈')) return '圈';
	}

	return '';
}

/**
 * 将通用研磨度转换为特定磨豆机的研磨度（用于显示在界面上）
 * 这是转化研磨度功能，将通用研磨度描述转换为特定磨豆机的刻度/格数
 * @param grindSize 通用研磨度描述 (e.g., "中细", "手冲")
 * @param grinderId 目标磨豆机 ID
 * @param customGrinders 自定义磨豆机列表
 * @returns 对应的特定磨豆机磨豆机设置，如果无法转换则返回原始值及建议
 */
export function convertToSpecificGrind(grindSize: string, grinderId: string, customGrinders?: CustomGrinder[]): string {
	if (!grindSize) return "";

	// 使用getReferenceGrindSizes来获取研磨度映射，包含自定义磨豆机
	const grindSizesMap = getReferenceGrindSizes(grinderId, customGrinders);

	// 如果找不到磨豆机或没有特定的研磨度映射，则返回原始值
	if (!grindSizesMap || Object.keys(grindSizesMap).length === 0) {
		return grindSize;
	}

	// 优先处理特定格式（如果输入已经是磨豆机的特定格式，直接返回）
	// 检查是否包含"格"或纯数字格式，这表明用户已经输入了具体的刻度
	if (grindSize.includes("格") || grindSize.match(/^\d+(-\d+)?$/)) {
		return grindSize;
	}

	// 尝试精确匹配通用描述
	let specificGrind = grindSizesMap[grindSize];
	if (specificGrind) {
		return specificGrind;
	}

	// 尝试部分匹配通用描述中的关键字
	for (const [key, value] of Object.entries(grindSizesMap)) {
		if (grindSize.includes(key)) {
			return value;
		}
	}

	// 尝试匹配冲煮方式
	if (grindSize.includes("意式") || grindSize.toLowerCase().includes("espresso")) {
		specificGrind = grindSizesMap["意式"];
	}
	if (grindSize.includes("摩卡") || grindSize.toLowerCase().includes("moka")) {
		specificGrind = grindSizesMap["摩卡壶"];
	}
	if (grindSize.includes("手冲") || grindSize.toLowerCase().includes("pour over")) {
		specificGrind = grindSizesMap["手冲"];
	}
	if (grindSize.includes("法压") || grindSize.toLowerCase().includes("french press")) {
		specificGrind = grindSizesMap["法压壶"];
	}
	if (grindSize.includes("冷萃") || grindSize.toLowerCase().includes("cold brew")) {
		specificGrind = grindSizesMap["冷萃"];
	}

	if (specificGrind) {
		return specificGrind;
	}

	// 如果无法转换，返回原始研磨度
	// 可以考虑添加通用的建议，但不应该硬编码特定磨豆机
	return grindSize;
}

/**
 * 根据设置格式化研磨度显示（用于UI显示）
 * 这是转化研磨度的主要函数，用于在界面上显示对应磨豆机的研磨度
 * @param grindSize 原始研磨度（可能包含磨豆机信息: "grinderId:value" 或纯文本）
 * @param grindType 磨豆机 ID (来自全局设置，作为fallback)
 * @param customGrinders 自定义磨豆机列表
 * @param options 可选配置 { showGrinderName: 是否显示磨豆机名称 }
 * @returns 格式化后的研磨度显示
 */
export function formatGrindSize(
	grindSize: string,
	grindType: string,
	customGrinders?: CustomGrinder[],
	options?: { showGrinderName?: boolean }
): string {
	if (!grindSize) return "";

	// 解析研磨度字符串
	const { grinderId, value } = parseGrindSize(grindSize);
	
	// 确定实际使用的磨豆机ID（优先使用研磨度中携带的ID，否则使用全局设置）
	const actualGrinderId = grinderId || grindType;

	// 如果是通用类型，直接返回值
	if (actualGrinderId === 'generic') {
		return value;
	}

	// 转换研磨度值
	const convertedValue = convertToSpecificGrind(value, actualGrinderId, customGrinders);

	// 如果需要显示磨豆机名称
	if (options?.showGrinderName) {
		// 使用降级处理，如果磨豆机不存在则显示通用
		const grinder = findGrinder(actualGrinderId, customGrinders, true);
		if (grinder) {
			return `${grinder.name} ${convertedValue}`;
		}
	}

	return convertedValue;
}

/**
 * 获取指定磨豆机的参考研磨度列表（用于设置页面显示）
 * 这是参考研磨度功能，只在设置页面显示，提供参考信息
 * @param grinderId 磨豆机ID
 * @param customGrinders 自定义磨豆机列表
 * @returns 研磨度映射对象，如果未找到则返回空对象
 */
export function getReferenceGrindSizes(grinderId: string, customGrinders?: CustomGrinder[]): Record<string, string> {
	// 先在内置磨豆机中查找
	const grinder = availableGrinders.find(g => g.id === grinderId);

	// 如果找到磨豆机且有研磨度映射，返回映射对象
	if (grinder && grinder.grindSizes) {
		return grinder.grindSizes;
	}

	// 在自定义磨豆机中查找
	if (customGrinders) {
		const customGrinder = customGrinders.find(g => g.id === grinderId);
		if (customGrinder && customGrinder.grindSizes) {
			return customGrinder.grindSizes as Record<string, string>;
		}
	}

	// 否则返回空对象
	return {};
}

/**
 * 获取分类后的研磨度参考表
 * @param grinderId 磨豆机ID
 * @param customGrinders 自定义磨豆机列表
 * @returns 包含基础研磨度和特定应用研磨度两个分类的对象
 */
export function getCategorizedGrindSizes(grinderId: string, customGrinders?: CustomGrinder[]): {
	basicGrindSizes: Record<string, string>;
	applicationGrindSizes: Record<string, string>;
} {
	const grindSizes = getReferenceGrindSizes(grinderId, customGrinders);
	const basicGrindSizes: Record<string, string> = {};
	const applicationGrindSizes: Record<string, string> = {};

	// 基础研磨度关键词
	const basicKeywords = ['极细', '特细', '细', '中细', '中细偏粗', '中粗', '粗', '特粗'];
	// 特定应用关键词
	const appKeywords = ['意式', '摩卡壶', '手冲', '法压壶', '冷萃'];

	Object.entries(grindSizes).forEach(([key, value]) => {
		if (basicKeywords.includes(key)) {
			basicGrindSizes[key] = value;
		} else if (appKeywords.includes(key)) {
			applicationGrindSizes[key] = value;
		}
	});

	return { basicGrindSizes, applicationGrindSizes };
}

/**
 * 获取用户的磨豆机列表（包括内置和自定义）
 * @param myGrinderIds 用户添加的磨豆机ID列表
 * @param customGrinders 自定义磨豆机列表
 * @returns 用户的磨豆机对象数组
 */
export function getMyGrinders(
	myGrinderIds: string[] = ['generic'],
	customGrinders?: CustomGrinder[]
): Array<{ id: string; name: string; grindSizes?: Record<string, string> }> {
	const grinders: Array<{ id: string; name: string; grindSizes?: Record<string, string> }> = [];

	myGrinderIds.forEach(id => {
		const grinder = findGrinder(id, customGrinders);
		if (grinder) {
			grinders.push(grinder);
		}
	});

	return grinders;
}

/**
 * 检查研磨度值是否是预设的标准值
 * @param grindSize 研磨度值
 * @param grinderId 磨豆机ID
 * @param customGrinders 自定义磨豆机列表
 * @returns 是否是预设值
 */
export function isPresetGrindSize(grindSize: string, grinderId: string, customGrinders?: CustomGrinder[]): boolean {
	if (!grindSize || !grinderId || grinderId === 'generic') return false;

	const grindSizesMap = getReferenceGrindSizes(grinderId, customGrinders);
	if (!grindSizesMap || Object.keys(grindSizesMap).length === 0) return false;

	// 检查是否精确匹配预设值
	return Object.values(grindSizesMap).includes(grindSize);
}

/**
 * 反向查找：从磨豆机特定刻度转换为通用研磨度描述
 * @param grindSize 磨豆机特定刻度（如"8格"）
 * @param grinderId 当前磨豆机ID
 * @param customGrinders 自定义磨豆机列表
 * @returns 通用研磨度描述（如"中细"），如果找不到则返回原值
 */
export function reverseConvertGrindSize(grindSize: string, grinderId: string, customGrinders?: CustomGrinder[]): string {
	if (!grindSize || !grinderId || grinderId === 'generic') return grindSize;

	const grindSizesMap = getReferenceGrindSizes(grinderId, customGrinders);
	if (!grindSizesMap || Object.keys(grindSizesMap).length === 0) return grindSize;

	// 查找匹配的键
	for (const [key, value] of Object.entries(grindSizesMap)) {
		if (value === grindSize) {
			return key;
		}
	}

	return grindSize;
}

/**
 * 智能转换研磨度值（在切换磨豆机时自动转换预设值）
 * @param currentValue 当前研磨度值
 * @param fromGrinderId 源磨豆机ID
 * @param toGrinderId 目标磨豆机ID
 * @param customGrinders 自定义磨豆机列表
 * @returns 转换后的研磨度值
 */
export function smartConvertGrindSize(
	currentValue: string,
	fromGrinderId: string,
	toGrinderId: string,
	customGrinders?: CustomGrinder[]
): string {
	// 如果目标磨豆机和源磨豆机相同，直接返回
	if (fromGrinderId === toGrinderId) {
		return currentValue;
	}

	// 常见研磨度描述（这些描述词应该总是被转换）
	const commonGrindDescriptions = ['极细', '特细', '细', '中细', '中细偏粗', '中粗', '粗', '特粗', '意式', '摩卡壶', '手冲', '法压壶', '冷萃'];
	const isCommonDescription = commonGrindDescriptions.includes(currentValue);
	
	// 检查当前研磨度值是否是旧磨豆机的预设值
	const isOldPreset = isPresetGrindSize(currentValue, fromGrinderId, customGrinders);
	
	// 如果是常见描述词，无论从哪个磨豆机切换，都应该转换
	// 如果是预设值（特定磨豆机的刻度），也应该转换
	if (isCommonDescription || isOldPreset) {
		// 1. 先将旧磨豆机的刻度反向转换为通用描述（如"8格" -> "中细"）
		const genericDescription = reverseConvertGrindSize(currentValue, fromGrinderId, customGrinders);
		
		// 2. 再将通用描述转换为新磨豆机的刻度（如"中细" -> "15-25格"）
		return convertToSpecificGrind(genericDescription, toGrinderId, customGrinders);
	}
	
	// 如果不是预设值（用户自己填写的），保持原值不变
	return currentValue;
}

/**
 * 检测用户是否只有通用研磨度（没有添加任何其他磨豆机）
 * @param myGrinders 用户的磨豆机列表
 * @returns 是否只有通用研磨度
 */
export function hasOnlyGenericGrinder(myGrinders?: string[]): boolean {
	if (!myGrinders || myGrinders.length === 0) {
		return true;
	}
	
	// 如果列表只包含一个元素且为 'generic'，则返回 true
	return myGrinders.length === 1 && myGrinders[0] === 'generic';
}

