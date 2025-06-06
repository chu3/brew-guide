import { Storage } from "@/lib/core/storage";
import { Method as _Method, CustomEquipment } from "@/lib/core/config";
import { CoffeeBean as _CoffeeBean, BlendComponent } from "@/types/app";
import { APP_VERSION } from "@/lib/core/config";
import { SettingsOptions as _SettingsOptions } from "@/components/settings/Settings";
import { LayoutSettings as _LayoutSettings } from "@/components/brewing/Timer/Settings";
import { db } from "@/lib/core/db";

// 检查是否在浏览器环境中
const isBrowser = typeof window !== 'undefined';

// 定义翻译函数接口
interface TranslationFunction {
	(key: string, params?: Record<string, string | number>): string;
}

// 定义导出数据的接口
interface ExportData {
	exportDate: string;
	appVersion: string;
	data: Record<string, unknown>;
}

// 定义导入数据的接口
interface ImportData {
	exportDate?: string;
	appVersion?: string;
	data?: Record<string, unknown>;
}

// 定义冲煮记录的接口
interface BrewingNote {
	id: string;
	timestamp: number;
	equipment?: string;
	method?: string;
	params?: {
		coffee: string;
		water: string;
		ratio: string;
		grindSize: string;
		temp: string;
	};
	[key: string]: unknown;
}

/**
 * 应用数据键名列表
 */
export const APP_DATA_KEYS = [
	"customMethods", // 自定义冲煮方案
	"brewingNotes", // 冲煮记录
	"brewGuideSettings", // 应用设置
	"brewingNotesVersion", // 数据版本
	"coffeeBeans", // 咖啡豆数据
	"customEquipments", // 自定义器具
	"onboardingCompleted", // 引导完成标记
];

/**
 * 自定义预设键名前缀
 */
const CUSTOM_PRESETS_PREFIX = "brew-guide:custom-presets:";

/**
 * 自定义预设键名列表
 */
const CUSTOM_PRESETS_KEYS = [
	"origins", // 产地
	"processes", // 处理法
	"varieties", // 品种
];

/**
 * 数据管理工具类
 */
export const DataManager = {
	/**
	 * 导出所有数据
	 * @param t 翻译函数
	 * @returns 包含所有数据的JSON字符串
	 */
	async exportAllData(t?: TranslationFunction): Promise<string> {
		try {
			const exportData: ExportData = {
				exportDate: new Date().toISOString(),
				appVersion: APP_VERSION,
				data: {},
			};

			// 获取所有数据
			for (const key of APP_DATA_KEYS) {
				const value = await Storage.get(key);
				if (value) {
					try {
						// 尝试解析JSON
						exportData.data[key] = JSON.parse(value);
						
						// 如果是冲煮笔记数据，清理冗余的咖啡豆信息
						if (key === "brewingNotes" && Array.isArray(exportData.data[key])) {
							exportData.data[key] = this.cleanBrewingNotesForExport(exportData.data[key] as BrewingNote[]);
						}
					} catch {
						// 如果不是JSON，直接存储字符串
						exportData.data[key] = value;
					}
				}
			}

			// 获取所有自定义方案
			try {
				// 获取所有存储键
				const allKeys = await Storage.keys();
				
				// 过滤出自定义方案键
				const methodKeys = allKeys.filter(key => key.startsWith("customMethods_"));
				
				// 如果有自定义方案，将它们添加到导出数据中
				if (methodKeys.length > 0) {
					// 初始化自定义方案存储结构
					exportData.data.customMethodsByEquipment = {};
					
					// 处理每个器具的自定义方案
					for (const key of methodKeys) {
						// 提取器具ID
						const equipmentId = key.replace("customMethods_", "");
						
						// 加载该器具的方案
						const methodsJson = await Storage.get(key);
						if (methodsJson) {
							try {
								const methods = JSON.parse(methodsJson);
								// 将当前器具的所有方案添加到导出数据中
								(exportData.data.customMethodsByEquipment as Record<string, unknown>)[equipmentId] = methods;
							} catch {
								// 如果JSON解析失败，跳过
								console.error(`解析自定义方案数据失败: ${key}`);
							}
						}
					}
				}
				
				// 尝试从IndexedDB加载更完整的自定义方案数据
				try {
					const methodsFromDB = await db.customMethods.toArray();
					if (methodsFromDB && methodsFromDB.length > 0) {
						// 确保customMethodsByEquipment已初始化
						if (!exportData.data.customMethodsByEquipment) {
							exportData.data.customMethodsByEquipment = {};
						}
						
						// 添加或更新来自IndexedDB的方案数据
						for (const item of methodsFromDB) {
							const { equipmentId, methods } = item;
							if (Array.isArray(methods) && methods.length > 0) {
								// 将当前器具的所有方案添加到导出数据中
								(exportData.data.customMethodsByEquipment as Record<string, unknown>)[equipmentId] = methods;
							}
						}
						
						// 检查自定义器具数据
						if (exportData.data.customEquipments && Array.isArray(exportData.data._customEquipments)) {
							const _customEquipments = exportData.data.customEquipments as CustomEquipment[];
						}
					}
				} catch (dbError) {
					console.error("从IndexedDB导出自定义方案失败:", dbError);
				}
			} catch (error) {
				console.error("导出自定义方案失败:", error);
				// 错误处理：即使自定义方案导出失败，也继续导出其他数据
			}

			// 导出自定义预设数据
			try {
				if (isBrowser) {
					// 初始化自定义预设存储结构
					exportData.data.customPresets = {};

					// 处理每个自定义预设类型
					for (const key of CUSTOM_PRESETS_KEYS) {
						const storageKey = `${CUSTOM_PRESETS_PREFIX}${key}`;
						const presetJson = localStorage.getItem(storageKey);
						
						if (presetJson) {
							try {
								const presets = JSON.parse(presetJson);
								// 将当前类型的所有自定义预设添加到导出数据中
								(exportData.data.customPresets as Record<string, unknown>)[key] = presets;
							} catch {
								// 如果JSON解析失败，跳过
								console.error(`解析自定义预设数据失败: ${key}`);
							}
						}
					}
				}
			} catch (error) {
				console.error("导出自定义预设失败:", error);
				// 错误处理：即使自定义预设导出失败，也继续导出其他数据
			}

			return JSON.stringify(exportData, null, 2);
		} catch {
			throw new Error(t ? t('export.failed') : "导出数据失败");
		}
	},

	/**
	 * 导入所有数据
	 * @param jsonString 包含所有数据的JSON字符串
	 * @param t 翻译函数
	 * @returns 导入结果
	 */
	async importAllData(
		jsonString: string,
		t?: TranslationFunction
	): Promise<{ success: boolean; message: string }> {
		try {
			const importData = JSON.parse(jsonString) as ImportData;

			// 验证数据格式
			if (!importData.data) {
				return {
					success: false,
					message: t ? t('import.invalidFormat') : "导入的数据格式不正确，缺少 data 字段",
				};
			}

			// 导入所有数据
			for (const key of APP_DATA_KEYS) {
				if (importData.data[key] !== undefined) {
					// 如果是对象或数组，转换为JSON字符串
					const value =
						typeof importData.data[key] === "object"
							? JSON.stringify(importData.data[key])
							: String(importData.data[key]);
					await Storage.set(key, value);
					
					// 对于自定义器具，同时更新IndexedDB
					if (key === 'customEquipments' && typeof importData.data[key] === 'object') {
						const rawEquipments = importData.data[key] as unknown[];
						if (Array.isArray(rawEquipments)) {
							// 首先清除现有数据
							await db.customEquipments.clear();
							// 然后导入新数据
							await db.customEquipments.bulkPut(rawEquipments as CustomEquipment[]);
						}
					}
				}
			}
			
			// 导入自定义方案数据
			if (importData.data.customMethodsByEquipment && typeof importData.data.customMethodsByEquipment === 'object') {
				// 清除现有方案数据
				await db.customMethods.clear();
				
				// 遍历所有器具的方案
				const customMethodsByEquipment = importData.data.customMethodsByEquipment as Record<string, unknown>;
				
				// 导入的自定义器具ID列表
				let _customEquipmentIds: string[] = [];
				if (importData.data.customEquipments && Array.isArray(importData.data._customEquipments)) {
					_customEquipmentIds = (importData.data.customEquipments as CustomEquipment[]).map(e => e.id);
				}
				
				for (const equipmentId of Object.keys(customMethodsByEquipment)) {
					const methods = customMethodsByEquipment[equipmentId];
					if (Array.isArray(methods)) {
						// 保存该器具的所有方案
						const storageKey = `customMethods_${equipmentId}`;
						await Storage.set(storageKey, JSON.stringify(methods));
						
						// 同时更新IndexedDB
						await db.customMethods.put({
							equipmentId,
							methods
						});
					}
				}
			}
			
			// 导入自定义预设数据
			if (isBrowser && importData.data.customPresets && typeof importData.data.customPresets === 'object') {
				// 遍历所有自定义预设类型
				const customPresets = importData.data.customPresets as Record<string, unknown>;
				for (const presetType of Object.keys(customPresets)) {
					if (CUSTOM_PRESETS_KEYS.includes(presetType)) {
						const presets = customPresets[presetType];
						if (Array.isArray(presets)) {
							// 保存该类型的所有自定义预设
							const storageKey = `${CUSTOM_PRESETS_PREFIX}${presetType}`;
							localStorage.setItem(storageKey, JSON.stringify(presets));
						}
					}
				}
			}
			
			// 触发数据变更事件，通知应用中的组件重新加载数据
			if (isBrowser) {
				// 触发自定义器具更新事件
				const equipmentEvent = new CustomEvent('customEquipmentUpdate', {
					detail: { source: 'importAllData' }
				});
				window.dispatchEvent(equipmentEvent);
				
				// 触发自定义方案更新事件
				const methodEvent = new CustomEvent('customMethodUpdate', {
					detail: { source: 'importAllData' }
				});
				window.dispatchEvent(methodEvent);
				
				// 触发一个通用的数据更改事件
				const dataChangeEvent = new CustomEvent('storage:changed', { 
					detail: { key: 'allData', action: 'import' } 
				});
				window.dispatchEvent(dataChangeEvent);
			}
			
			const exportDate = importData.exportDate
				? new Date(importData.exportDate).toLocaleString()
				: (t ? t('import.unknownDate') : "未知");

			return {
				success: true,
				message: t
					? t('import.success', { exportDate })
					: `数据导入成功，导出日期: ${exportDate}`,
			};
		} catch (_error) {
			return {
				success: false,
				message: t
					? t('import.failed', { error: (_error as Error).message })
					: `导入数据失败: ${(_error as Error).message}`,
			};
		}
	},

	/**
	 * 重置所有数据
	 * @param completeReset 是否完全重置（包括所有设置和缓存）
	 * @param t 翻译函数
	 * @returns 重置结果
	 */
	async resetAllData(
		completeReset = false,
		t?: TranslationFunction
	): Promise<{ success: boolean; message: string }> {
		try {
			// 清除列表中的数据
			for (const key of APP_DATA_KEYS) {
				await Storage.remove(key);

				// 确保IndexedDB中的主要表也被清理
				if (key === 'brewingNotes') {
					await db.brewingNotes.clear();
				} else if (key === 'coffeeBeans') {
					await db.coffeeBeans.clear();
				}
			}

			// 如果是完全重置，还需要清除其他数据
			if (completeReset) {
				// 获取所有存储键
				const allKeys = await Storage.keys();

				// 清除所有自定义方案
				const methodKeys = allKeys.filter(key => key.startsWith("customMethods_"));
				for (const key of methodKeys) {
					await Storage.remove(key);
				}

				// 同时清除IndexedDB数据
				await db.customEquipments.clear();
				await db.customMethods.clear();
				await db.settings.clear(); // 清除设置表，包括迁移标记

				// 清除所有自定义预设
				if (isBrowser) {
					for (const key of CUSTOM_PRESETS_KEYS) {
						localStorage.removeItem(`${CUSTOM_PRESETS_PREFIX}${key}`);
					}

					// 清除所有状态持久化数据（brew-guide: 前缀的键）
					const localStorageKeys = Object.keys(localStorage);
					const stateKeys = localStorageKeys.filter(key => key.startsWith("brew-guide:"));
					for (const key of stateKeys) {
						localStorage.removeItem(key);
					}

					// 清除冲煮相关的临时状态
					const brewingStateKeys = [
						'brewingNoteInProgress',
						'skipMethodToNotes',
						'dataMigrationSkippedThisSession'
					];
					for (const key of brewingStateKeys) {
						localStorage.removeItem(key);
					}

					// 清除sessionStorage中的临时数据
					try {
						sessionStorage.clear();
					} catch (error) {
						console.warn('清除sessionStorage失败:', error);
					}
				}
			}

			// 触发数据变更事件，通知应用中的组件重新加载数据
			if (isBrowser) {
				// 触发自定义器具更新事件
				const equipmentEvent = new CustomEvent('customEquipmentUpdate', {
					detail: { source: 'resetAllData' }
				});
				window.dispatchEvent(equipmentEvent);

				// 触发自定义方案更新事件
				const methodEvent = new CustomEvent('customMethodUpdate', {
					detail: { source: 'resetAllData' }
				});
				window.dispatchEvent(methodEvent);

				// 触发全局缓存重置事件
				const cacheResetEvent = new CustomEvent('globalCacheReset', {
					detail: { source: 'resetAllData' }
				});
				window.dispatchEvent(cacheResetEvent);

				// 触发一个通用的数据更改事件
				const dataChangeEvent = new CustomEvent('storage:changed', {
					detail: { key: 'allData', action: 'reset' }
				});
				window.dispatchEvent(dataChangeEvent);
			}

			return {
				success: true,
				message: completeReset
					? (t ? t('reset.completeSuccess') : "已完全重置所有数据和设置")
					: (t ? t('reset.partialSuccess') : "已重置主要数据"),
			};
		} catch (_error) {
			console.error('重置数据失败:', _error);
			return {
				success: false,
				message: t ? t('reset.failed') : "重置数据失败",
			};
		}
	},

	/**
	 * 检查是否为有效的文本（非占位符）
	 * @param text 要检查的文本
	 * @returns 是否为有效文本
	 */
	isValidText(text: string | undefined | null): boolean {
		if (!text || typeof text !== 'string') return false;

		const trimmed = text.trim();
		if (trimmed === '') return false;

		// 占位符文本列表
		const placeholders = [
			'产地', 'origin', 'Origin',
			'处理法', 'process', 'Process', '水洗', '日晒', '蜜处理',
			'品种', 'variety', 'Variety',
			'烘焙度', 'roast', 'Roast'
		];

		return !placeholders.includes(trimmed);
	},

	/**
	 * 检查咖啡豆是否有有效的旧格式字段
	 * @param bean 咖啡豆对象
	 * @returns 是否有有效的旧格式字段
	 */
	hasValidLegacyFields(bean: any): boolean {
		return this.isValidText(bean.origin) ||
			   this.isValidText(bean.process) ||
			   this.isValidText(bean.variety);
	},

	/**
	 * 检测是否存在旧格式的咖啡豆数据
	 * @returns 检测结果，包含是否存在旧格式数据和数量
	 */
	async detectLegacyBeanData(): Promise<{ hasLegacyData: boolean; legacyCount: number; totalCount: number }> {
		try {
			// 获取所有咖啡豆数据
			const beansStr = await Storage.get('coffeeBeans');
			if (!beansStr) {
				return { hasLegacyData: false, legacyCount: 0, totalCount: 0 };
			}

			// 解析咖啡豆数据
			const beans = JSON.parse(beansStr);
			if (!Array.isArray(beans)) {
				return { hasLegacyData: false, legacyCount: 0, totalCount: 0 };
			}

			let legacyCount = 0;

			// 检查每个咖啡豆是否使用旧格式
			beans.forEach((bean) => {
				// 检查是否存在有效的旧格式字段（排除占位符）
				const hasValidLegacyFields = this.hasValidLegacyFields(bean);

				if (hasValidLegacyFields) {
					legacyCount++;
				}
			});

			return {
				hasLegacyData: legacyCount > 0,
				legacyCount,
				totalCount: beans.length
			};
		} catch (error) {
			console.error('检测旧格式数据失败:', error);
			return { hasLegacyData: false, legacyCount: 0, totalCount: 0 };
		}
	},

	/**
	 * 迁移旧格式咖啡豆数据到新格式
	 * @returns 迁移结果，包含迁移数量
	 */
	async migrateLegacyBeanData(): Promise<{ success: boolean; migratedCount: number; message: string }> {
		try {
			// 获取所有咖啡豆数据
			const beansStr = await Storage.get('coffeeBeans');
			if (!beansStr) {
				return { success: true, migratedCount: 0, message: '没有找到咖啡豆数据' };
			}

			// 解析咖啡豆数据
			const beans = JSON.parse(beansStr);
			if (!Array.isArray(beans)) {
				return { success: false, migratedCount: 0, message: '咖啡豆数据格式错误' };
			}

			let migratedCount = 0;

			// 处理每个咖啡豆
			const migratedBeans = beans.map((bean) => {
				// 检查是否需要迁移（存在有效的旧格式字段）
				const hasValidLegacyFields = this.hasValidLegacyFields(bean);

				if (hasValidLegacyFields) {
					// 如果没有blendComponents，创建新的
					if (!bean.blendComponents || !Array.isArray(bean.blendComponents) || bean.blendComponents.length === 0) {
						bean.blendComponents = [{
							origin: this.isValidText(bean.origin) ? bean.origin : '',
							process: this.isValidText(bean.process) ? bean.process : '',
							variety: this.isValidText(bean.variety) ? bean.variety : ''
						}];
					}
					// 如果已经有blendComponents，但旧字段的信息更完整，则更新blendComponents
					else {
						// 检查第一个组件是否需要更新
						const firstComponent = bean.blendComponents[0];
						if (!this.isValidText(firstComponent.origin) && this.isValidText(bean.origin)) {
							firstComponent.origin = bean.origin;
						}
						if (!this.isValidText(firstComponent.process) && this.isValidText(bean.process)) {
							firstComponent.process = bean.process;
						}
						if (!this.isValidText(firstComponent.variety) && this.isValidText(bean.variety)) {
							firstComponent.variety = bean.variety;
						}
					}

					migratedCount++;
				}

				// 总是删除旧的字段（无论是否有效），避免数据重复
				delete bean.origin;
				delete bean.process;
				delete bean.variety;

				return bean;
			});

			// 如果有迁移，更新存储
			if (migratedCount > 0) {
				await Storage.set('coffeeBeans', JSON.stringify(migratedBeans));

				// 同时更新IndexedDB
				try {
					await db.coffeeBeans.clear();
					await db.coffeeBeans.bulkPut(migratedBeans);
				} catch (dbError) {
					console.error('更新IndexedDB失败:', dbError);
				}
			}

			return {
				success: true,
				migratedCount,
				message: migratedCount > 0 ? `成功迁移了${migratedCount}个咖啡豆的数据格式` : '没有需要迁移的数据'
			};
		} catch (error) {
			console.error('迁移数据失败:', error);
			return {
				success: false,
				migratedCount: 0,
				message: `迁移失败: ${(error as Error).message}`
			};
		}
	},

	/**
	 * 修复咖啡豆数据问题
	 * 处理可能存在问题的咖啡豆数据，确保blendComponents字段正确，删除废弃的type字段
	 * @returns 修复结果，包含修复数量
	 */
	async fixBlendBeansData(): Promise<{ success: boolean; fixedCount: number }> {
		try {
			// 获取所有咖啡豆数据
			const beansStr = await Storage.get('coffeeBeans');
			if (!beansStr) {
				return { success: true, fixedCount: 0 };
			}

			// 解析咖啡豆数据
			const beans = JSON.parse(beansStr);
			if (!Array.isArray(beans)) {
				return { success: false, fixedCount: 0 };
			}

			let fixedCount = 0;

			// 处理每个咖啡豆
			const fixedBeans = beans.map((bean) => {
				// 删除已废弃的type字段
				if ('type' in bean) {
					delete (bean as any).type;
					fixedCount++;
				}

				// 确保所有咖啡豆都有blendComponents字段
				if (!bean.blendComponents || !Array.isArray(bean.blendComponents) || bean.blendComponents.length === 0) {
					bean.blendComponents = [{
						origin: bean.origin || '',
						process: bean.process || '',
						variety: bean.variety || ''
					}];
					fixedCount++;
				}

				// 确保所有拼配成分都有正确的属性
				if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
					bean.blendComponents = bean.blendComponents.map((comp: BlendComponent) => {
						// 只修复无效的百分比值，而不是强制设置所有未定义的百分比
						if (comp.percentage !== undefined) {
							// 仅当百分比是无效值时修复
							if (typeof comp.percentage === 'number' && (comp.percentage < 1 || comp.percentage > 100)) {
								// 如果百分比值无效，将其约束在1-100范围内
								comp.percentage = Math.min(Math.max(1, comp.percentage), 100);
								fixedCount++;
							} else if (typeof comp.percentage !== 'number') {
								// 如果不是数字类型，尝试转换为数字
								try {
									const numValue = Number(comp.percentage);
									if (!isNaN(numValue)) {
										comp.percentage = Math.min(Math.max(1, numValue), 100);
									} else {
										// 如果无法转换为有效数字，移除百分比属性
										delete comp.percentage;
									}
									fixedCount++;
								} catch {
									// 转换失败，移除百分比属性
									delete comp.percentage;
									fixedCount++;
								}
							}
						}
						// 如果百分比为undefined，保持原样，不进行修复
						return comp;
					});
				}

				return bean;
			});

			// 如果有修复，更新存储
			if (fixedCount > 0) {
				await Storage.set('coffeeBeans', JSON.stringify(fixedBeans));
			}

			return { success: true, fixedCount };
		} catch (error) {
			console.error('修复拼配豆数据失败:', error);
			return { success: false, fixedCount: 0 };
		}
	},

	/**
	 * 清理冲煮笔记中的冗余咖啡豆数据
	 * 移除每个笔记中的完整coffeeBean对象，只保留必要的beanId和coffeeBeanInfo
	 * @param notes 冲煮笔记数组
	 * @returns 清理后的冲煮笔记数组
	 */
	cleanBrewingNotesForExport(notes: BrewingNote[]): BrewingNote[] {
		return notes.map(note => {
			// 创建笔记的浅拷贝
			const cleanedNote = { ...note };
			
			// 删除coffeeBean字段，它包含完整的咖啡豆对象
			if ('coffeeBean' in cleanedNote) {
				delete cleanedNote.coffeeBean;
			}
			
			return cleanedNote;
		});
	},
};
