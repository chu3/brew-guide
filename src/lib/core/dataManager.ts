import { Storage } from "@/lib/core/storage";
import { Method as _Method, CustomEquipment } from "@/lib/core/config";
import { CoffeeBean as _CoffeeBean, BlendComponent } from "@/types/app";
import { APP_VERSION } from "@/lib/core/config";
import { SettingsOptions as _SettingsOptions } from "@/components/settings/Settings";
import { LayoutSettings as _LayoutSettings } from "@/components/brewing/Timer/Settings";
import { db } from "@/lib/core/db";
import * as XLSX from 'xlsx';

// 检查是否在浏览器环境中
const isBrowser = typeof window !== 'undefined';

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
	 * @returns 包含所有数据的JSON字符串
	 */
	async exportAllData(): Promise<string> {
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
			throw new Error("导出数据失败");
		}
	},

	/**
	 * 导入所有数据
	 * @param jsonString 包含所有数据的JSON字符串
	 * @returns 导入结果
	 */
	async importAllData(
		jsonString: string
	): Promise<{ success: boolean; message: string }> {
		try {
			const importData = JSON.parse(jsonString) as ImportData;

			// 验证数据格式
			if (!importData.data) {
				return {
					success: false,
					message: "导入的数据格式不正确，缺少 data 字段",
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
			
			return {
				success: true,
				message: `数据导入成功，导出日期: ${
					importData.exportDate
						? new Date(importData.exportDate).toLocaleString()
						: "未知"
				}`,
			};
		} catch (_error) {
			return {
				success: false,
				message: `导入数据失败: ${(_error as Error).message}`,
			};
		}
	},

	/**
	 * 重置所有数据
	 * @param completeReset 是否完全重置（包括所有设置和缓存）
	 * @returns 重置结果
	 */
	async resetAllData(
		completeReset = false
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
					? "已完全重置所有数据和设置"
					: "已重置主要数据",
			};
		} catch (_error) {
			console.error('重置数据失败:', _error);
			return {
				success: false,
				message: "重置数据失败",
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

	/**
	 * 导出所有数据为Excel格式
	 * @returns Excel文件的Blob对象
	 */
	async exportAllDataAsExcel(): Promise<Blob> {
		try {
			// 创建新的工作簿
			const workbook = XLSX.utils.book_new();

			// 1. 导出咖啡豆数据
			await this.addCoffeeBeansSheet(workbook);

			// 2. 导出冲煮记录
			await this.addBrewingNotesSheet(workbook);

			// 3. 导出应用设置
			await this.addSettingsSheet(workbook);

			// 4. 导出自定义器具
			await this.addCustomEquipmentsSheet(workbook);

			// 5. 导出自定义方案
			await this.addCustomMethodsSheet(workbook);

			// 6. 导出自定义预设
			await this.addCustomPresetsSheet(workbook);

			// 7. 添加导出信息工作表
			this.addExportInfoSheet(workbook);

			// 生成Excel文件
			const excelBuffer = XLSX.write(workbook, {
				bookType: 'xlsx',
				type: 'array',
				compression: true
			});

			// 创建Blob对象
			return new Blob([excelBuffer], {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});

		} catch (error) {
			console.error('导出Excel失败:', error);
			throw new Error(`导出Excel失败: ${(error as Error).message}`);
		}
	},

	/**
	 * 添加咖啡豆数据工作表
	 */
	async addCoffeeBeansSheet(workbook: XLSX.WorkBook): Promise<void> {
		try {
			const beansStr = await Storage.get('coffeeBeans');
			if (!beansStr) {
				// 创建空的咖啡豆工作表
				const emptySheet = XLSX.utils.aoa_to_sheet([['暂无咖啡豆数据']]);
				XLSX.utils.book_append_sheet(workbook, emptySheet, '咖啡豆');
				return;
			}

			const beans = JSON.parse(beansStr) as _CoffeeBean[];
			if (!Array.isArray(beans) || beans.length === 0) {
				const emptySheet = XLSX.utils.aoa_to_sheet([['暂无咖啡豆数据']]);
				XLSX.utils.book_append_sheet(workbook, emptySheet, '咖啡豆');
				return;
			}

			// 准备表头
			const headers = [
				'ID', '名称', '烘焙度', '烘焙日期', '产地', '处理法', '品种',
				'容量', '剩余量', '价格', '豆子类型', '风味描述', '备注',
				'开始使用天数', '结束使用天数', '是否冰冻', '是否在途',
				'总体评分', '评价备注', '成分详情', '创建时间'
			];

			// 准备数据行
			const rows = beans.map(bean => {
				// 从blendComponents中提取产地、处理法、品种信息
				let origin = '';
				let process = '';
				let variety = '';

				// 将bean转换为any类型以访问可能存在的blendComponents字段
				const extendedBean = bean as any;

				// 优先使用blendComponents中的信息
				if (Array.isArray(extendedBean.blendComponents) && extendedBean.blendComponents.length > 0) {
					const firstComponent = extendedBean.blendComponents[0];
					origin = firstComponent.origin || '';
					process = firstComponent.process || '';
					variety = firstComponent.variety || '';
				}

				// 如果blendComponents为空，尝试使用顶层字段（兼容旧数据）
				if (!origin && extendedBean.origin) origin = extendedBean.origin;
				if (!process && extendedBean.process) process = extendedBean.process;
				if (!variety && extendedBean.variety) variety = extendedBean.variety;

				// 生成成分详情字符串
				let componentDetails = '';
				if (Array.isArray(extendedBean.blendComponents) && extendedBean.blendComponents.length > 0) {
					if (extendedBean.blendComponents.length === 1) {
						// 单品咖啡：只显示基本信息
						const component = extendedBean.blendComponents[0];
						const parts = [];
						if (component.origin) parts.push(`产地:${component.origin}`);
						if (component.process) parts.push(`处理法:${component.process}`);
						if (component.variety) parts.push(`品种:${component.variety}`);
						componentDetails = parts.join(' ');
					} else {
						// 拼配咖啡：显示所有成分的详细信息
						componentDetails = extendedBean.blendComponents.map((component: any, index: number) => {
							const parts = [];
							if (component.percentage) parts.push(`${component.percentage}%`);
							if (component.origin) parts.push(`产地:${component.origin}`);
							if (component.process) parts.push(`处理法:${component.process}`);
							if (component.variety) parts.push(`品种:${component.variety}`);
							return `成分${index + 1}: ${parts.join(' ')}`;
						}).join(' | ');
					}
				}

				return [
					bean.id || '',
					bean.name || '',
					bean.roastLevel || '',
					bean.roastDate || '',
					origin,
					process,
					variety,
					bean.capacity || '',
					bean.remaining || '',
					bean.price || '',
					bean.beanType || '',
					Array.isArray(bean.flavor) ? bean.flavor.join(', ') : (bean.flavor || ''),
					bean.notes || '',
					bean.startDay || '',
					bean.endDay || '',
					bean.isFrozen ? '是' : '否',
					bean.isInTransit ? '是' : '否',
					bean.overallRating || '',
					bean.ratingNotes || '',
					componentDetails,
					bean.timestamp ? new Date(bean.timestamp).toLocaleString() : ''
				];
			});

			// 创建工作表
			const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

			// 设置列宽
			const colWidths = [
				{ wch: 15 }, // ID
				{ wch: 20 }, // 名称
				{ wch: 10 }, // 烘焙度
				{ wch: 12 }, // 烘焙日期
				{ wch: 15 }, // 产地
				{ wch: 10 }, // 处理法
				{ wch: 15 }, // 品种
				{ wch: 8 },  // 容量
				{ wch: 8 },  // 剩余量
				{ wch: 8 },  // 价格
				{ wch: 10 }, // 豆子类型
				{ wch: 30 }, // 风味描述
				{ wch: 20 }, // 备注
				{ wch: 12 }, // 开始使用天数
				{ wch: 12 }, // 结束使用天数
				{ wch: 8 },  // 是否冰冻
				{ wch: 8 },  // 是否在途
				{ wch: 10 }, // 总体评分
				{ wch: 20 }, // 评价备注
				{ wch: 40 }, // 成分详情
				{ wch: 18 }  // 创建时间
			];
			worksheet['!cols'] = colWidths;

			XLSX.utils.book_append_sheet(workbook, worksheet, '咖啡豆');

		} catch (error) {
			console.error('添加咖啡豆工作表失败:', error);
			// 添加错误信息工作表
			const errorSheet = XLSX.utils.aoa_to_sheet([['咖啡豆数据导出失败', (error as Error).message]]);
			XLSX.utils.book_append_sheet(workbook, errorSheet, '咖啡豆');
		}
	},

	/**
	 * 添加冲煮记录工作表
	 */
	async addBrewingNotesSheet(workbook: XLSX.WorkBook): Promise<void> {
		try {
			const notesStr = await Storage.get('brewingNotes');
			if (!notesStr) {
				const emptySheet = XLSX.utils.aoa_to_sheet([['暂无冲煮记录']]);
				XLSX.utils.book_append_sheet(workbook, emptySheet, '冲煮记录');
				return;
			}

			const notes = JSON.parse(notesStr);
			if (!Array.isArray(notes) || notes.length === 0) {
				const emptySheet = XLSX.utils.aoa_to_sheet([['暂无冲煮记录']]);
				XLSX.utils.book_append_sheet(workbook, emptySheet, '冲煮记录');
				return;
			}

			// 准备表头
			const headers = [
				'ID', '器具', '方案', '咖啡豆名称', '咖啡豆烘焙度', '咖啡豆烘焙日期',
				'咖啡用量', '水量', '粉水比', '研磨度', '水温',
				'总时长(秒)', '评分', '酸度', '甜度', '苦味', '口感',
				'备注', '来源', '快捷扣除量', '关联咖啡豆ID', '创建时间'
			];

			// 准备数据行
			const rows = notes.map((note: any) => [
				note.id || '',
				note.equipment || '',
				note.method || '',
				note.coffeeBeanInfo?.name || '',
				note.coffeeBeanInfo?.roastLevel || '',
				note.coffeeBeanInfo?.roastDate || '',
				note.params?.coffee || '',
				note.params?.water || '',
				note.params?.ratio || '',
				note.params?.grindSize || '',
				note.params?.temp || '',
				note.totalTime || '',
				note.rating || '',
				note.taste?.acidity || '',
				note.taste?.sweetness || '',
				note.taste?.bitterness || '',
				note.taste?.body || '',
				note.notes || '',
				note.source || '',
				note.quickDecrementAmount || '',
				note.beanId || '',
				note.timestamp ? new Date(note.timestamp).toLocaleString() : ''
			]);

			// 创建工作表
			const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

			// 设置列宽
			const colWidths = [
				{ wch: 15 }, // ID
				{ wch: 12 }, // 器具
				{ wch: 20 }, // 方案
				{ wch: 20 }, // 咖啡豆名称
				{ wch: 10 }, // 咖啡豆烘焙度
				{ wch: 12 }, // 咖啡豆烘焙日期
				{ wch: 10 }, // 咖啡用量
				{ wch: 8 },  // 水量
				{ wch: 8 },  // 粉水比
				{ wch: 10 }, // 研磨度
				{ wch: 8 },  // 水温
				{ wch: 10 }, // 总时长
				{ wch: 6 },  // 评分
				{ wch: 6 },  // 酸度
				{ wch: 6 },  // 甜度
				{ wch: 6 },  // 苦味
				{ wch: 8 },  // 口感
				{ wch: 30 }, // 备注
				{ wch: 15 }, // 来源
				{ wch: 10 }, // 快捷扣除量
				{ wch: 15 }, // 关联咖啡豆ID
				{ wch: 18 }  // 创建时间
			];
			worksheet['!cols'] = colWidths;

			XLSX.utils.book_append_sheet(workbook, worksheet, '冲煮记录');

		} catch (error) {
			console.error('添加冲煮记录工作表失败:', error);
			const errorSheet = XLSX.utils.aoa_to_sheet([['冲煮记录数据导出失败', (error as Error).message]]);
			XLSX.utils.book_append_sheet(workbook, errorSheet, '冲煮记录');
		}
	},

	/**
	 * 添加应用设置工作表
	 */
	async addSettingsSheet(workbook: XLSX.WorkBook): Promise<void> {
		try {
			const settingsStr = await Storage.get('brewGuideSettings');
			if (!settingsStr) {
				const emptySheet = XLSX.utils.aoa_to_sheet([['暂无应用设置']]);
				XLSX.utils.book_append_sheet(workbook, emptySheet, '应用设置');
				return;
			}

			const settings = JSON.parse(settingsStr) as _SettingsOptions;

			// 准备设置数据
			const settingsData = [
				['设置项', '值', '说明'],
				['通知声音', settings.notificationSound ? '开启' : '关闭', '计时器完成时是否播放声音'],
				['触觉反馈', settings.hapticFeedback ? '开启' : '关闭', '操作时是否提供触觉反馈'],
				['磨豆机类型', settings.grindType || '', '选择的磨豆机类型'],
				['文本缩放级别', settings.textZoomLevel?.toString() || '1.0', '界面文本缩放比例'],
				['显示流速', settings.showFlowRate ? '是' : '否', '是否在冲煮时显示流速信息'],
				['用户名', settings.username || '', '用户设置的名称'],
				['只显示咖啡豆名称', settings.showOnlyBeanName ? '是' : '否', '是否简化咖啡豆显示'],
				['显示赏味期', settings.showFlavorPeriod ? '是' : '否', '是否显示赏味期而非烘焙日期'],
				['简单表单模式', settings.simpleBeanFormMode ? '是' : '否', '咖啡豆表单是否使用简单模式'],
				['库存扣除预设', Array.isArray(settings.decrementPresets) ? settings.decrementPresets.join(', ') : '', '快捷扣除量预设值'],
				['顶部安全边距', settings.safeAreaMargins?.top?.toString() || '38', '界面顶部边距'],
				['底部安全边距', settings.safeAreaMargins?.bottom?.toString() || '38', '界面底部边距']
			];

			// 如果有布局设置，添加布局相关设置
			if (settings.layoutSettings) {
				const layout = settings.layoutSettings;
				settingsData.push(
					['阶段信息反转', layout.stageInfoReversed ? '是' : '否', '是否反转阶段信息布局'],
					['进度条高度', layout.progressBarHeight?.toString() || '4', '进度条高度（像素）'],
					['控制区反转', layout.controlsReversed ? '是' : '否', '是否反转底部控制区布局'],
					['始终显示计时器信息', layout.alwaysShowTimerInfo ? '是' : '否', '是否始终显示计时器信息区域'],
					['显示阶段分隔线', layout.showStageDivider ? '是' : '否', '是否显示阶段分隔线']
				);
			}

			// 如果有自定义磨豆机，添加相关信息
			if (Array.isArray(settings.customGrinders) && settings.customGrinders.length > 0) {
				settingsData.push(['自定义磨豆机数量', settings.customGrinders.length.toString(), '用户添加的自定义磨豆机数量']);
			}

			// 创建工作表
			const worksheet = XLSX.utils.aoa_to_sheet(settingsData);

			// 设置列宽
			worksheet['!cols'] = [
				{ wch: 20 }, // 设置项
				{ wch: 15 }, // 值
				{ wch: 40 }  // 说明
			];

			XLSX.utils.book_append_sheet(workbook, worksheet, '应用设置');

		} catch (error) {
			console.error('添加应用设置工作表失败:', error);
			const errorSheet = XLSX.utils.aoa_to_sheet([['应用设置数据导出失败', (error as Error).message]]);
			XLSX.utils.book_append_sheet(workbook, errorSheet, '应用设置');
		}
	},

	/**
	 * 添加自定义器具工作表
	 */
	async addCustomEquipmentsSheet(workbook: XLSX.WorkBook): Promise<void> {
		try {
			const equipmentsStr = await Storage.get('customEquipments');
			let equipments: CustomEquipment[] = [];

			if (equipmentsStr) {
				equipments = JSON.parse(equipmentsStr);
			}

			// 同时尝试从IndexedDB获取数据
			try {
				const dbEquipments = await db.customEquipments.toArray();
				if (dbEquipments && dbEquipments.length > 0) {
					// 合并数据，优先使用IndexedDB的数据
					const equipmentMap = new Map();
					equipments.forEach(eq => equipmentMap.set(eq.id, eq));
					dbEquipments.forEach(eq => equipmentMap.set(eq.id, eq));
					equipments = Array.from(equipmentMap.values());
				}
			} catch (dbError) {
				console.warn('从IndexedDB获取自定义器具失败:', dbError);
			}

			if (!Array.isArray(equipments) || equipments.length === 0) {
				const emptySheet = XLSX.utils.aoa_to_sheet([['暂无自定义器具']]);
				XLSX.utils.book_append_sheet(workbook, emptySheet, '自定义器具');
				return;
			}

			// 准备表头
			const headers = [
				'ID', '名称', '备注', '动画类型', '是否有阀门', '是否自定义',
				'自定义形状SVG', '自定义阀门SVG', '自定义阀门开启SVG', '自定义动画数量'
			];

			// 准备数据行
			const rows = equipments.map(equipment => [
				equipment.id || '',
				equipment.name || '',
				equipment.note || '',
				equipment.animationType || '',
				equipment.hasValve ? '是' : '否',
				equipment.isCustom ? '是' : '否',
				equipment.customShapeSvg ? '有' : '无',
				equipment.customValveSvg ? '有' : '无',
				equipment.customValveOpenSvg ? '有' : '无',
				Array.isArray(equipment.customPourAnimations) ? equipment.customPourAnimations.length.toString() : '0'
			]);

			// 创建工作表
			const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

			// 设置列宽
			const colWidths = [
				{ wch: 15 }, // ID
				{ wch: 20 }, // 名称
				{ wch: 30 }, // 备注
				{ wch: 12 }, // 动画类型
				{ wch: 10 }, // 是否有阀门
				{ wch: 10 }, // 是否自定义
				{ wch: 15 }, // 自定义形状SVG
				{ wch: 15 }, // 自定义阀门SVG
				{ wch: 18 }, // 自定义阀门开启SVG
				{ wch: 15 }  // 自定义动画数量
			];
			worksheet['!cols'] = colWidths;

			XLSX.utils.book_append_sheet(workbook, worksheet, '自定义器具');

		} catch (error) {
			console.error('添加自定义器具工作表失败:', error);
			const errorSheet = XLSX.utils.aoa_to_sheet([['自定义器具数据导出失败', (error as Error).message]]);
			XLSX.utils.book_append_sheet(workbook, errorSheet, '自定义器具');
		}
	},

	/**
	 * 添加自定义方案工作表
	 */
	async addCustomMethodsSheet(workbook: XLSX.WorkBook): Promise<void> {
		try {
			let allMethods: Array<{ equipmentId: string; method: _Method }> = [];

			// 从Storage获取自定义方案
			try {
				const allKeys = await Storage.keys();
				const methodKeys = allKeys.filter(key => key.startsWith("customMethods_"));

				for (const key of methodKeys) {
					const equipmentId = key.replace("customMethods_", "");
					const methodsJson = await Storage.get(key);
					if (methodsJson) {
						const methods = JSON.parse(methodsJson) as _Method[];
						if (Array.isArray(methods)) {
							methods.forEach(method => {
								allMethods.push({ equipmentId, method });
							});
						}
					}
				}
			} catch (storageError) {
				console.warn('从Storage获取自定义方案失败:', storageError);
			}

			// 从IndexedDB获取自定义方案
			try {
				const dbMethods = await db.customMethods.toArray();
				if (dbMethods && dbMethods.length > 0) {
					// 合并数据，优先使用IndexedDB的数据
					const methodMap = new Map();
					allMethods.forEach(item => {
						const key = `${item.equipmentId}-${item.method.id || item.method.name}`;
						methodMap.set(key, item);
					});

					dbMethods.forEach(item => {
						if (Array.isArray(item.methods)) {
							item.methods.forEach(method => {
								const key = `${item.equipmentId}-${method.id || method.name}`;
								methodMap.set(key, { equipmentId: item.equipmentId, method });
							});
						}
					});

					allMethods = Array.from(methodMap.values());
				}
			} catch (dbError) {
				console.warn('从IndexedDB获取自定义方案失败:', dbError);
			}

			if (allMethods.length === 0) {
				const emptySheet = XLSX.utils.aoa_to_sheet([['暂无自定义方案']]);
				XLSX.utils.book_append_sheet(workbook, emptySheet, '自定义方案');
				return;
			}

			// 准备表头
			const headers = [
				'器具ID', '方案ID', '方案名称', '咖啡用量', '水量', '粉水比',
				'研磨度', '水温', '烘焙度', '视频链接', '阶段数量', '创建时间'
			];

			// 准备数据行
			const rows = allMethods.map(item => [
				item.equipmentId || '',
				item.method.id || '',
				item.method.name || '',
				item.method.params?.coffee || '',
				item.method.params?.water || '',
				item.method.params?.ratio || '',
				item.method.params?.grindSize || '',
				item.method.params?.temp || '',
				item.method.params?.roastLevel || '',
				item.method.params?.videoUrl || '',
				Array.isArray(item.method.params?.stages) ? item.method.params.stages.length.toString() : '0',
				item.method.timestamp ? new Date(item.method.timestamp).toLocaleString() : ''
			]);

			// 创建工作表
			const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

			// 设置列宽
			const colWidths = [
				{ wch: 15 }, // 器具ID
				{ wch: 15 }, // 方案ID
				{ wch: 25 }, // 方案名称
				{ wch: 10 }, // 咖啡用量
				{ wch: 8 },  // 水量
				{ wch: 8 },  // 粉水比
				{ wch: 10 }, // 研磨度
				{ wch: 8 },  // 水温
				{ wch: 10 }, // 烘焙度
				{ wch: 20 }, // 视频链接
				{ wch: 10 }, // 阶段数量
				{ wch: 18 }  // 创建时间
			];
			worksheet['!cols'] = colWidths;

			XLSX.utils.book_append_sheet(workbook, worksheet, '自定义方案');

		} catch (error) {
			console.error('添加自定义方案工作表失败:', error);
			const errorSheet = XLSX.utils.aoa_to_sheet([['自定义方案数据导出失败', (error as Error).message]]);
			XLSX.utils.book_append_sheet(workbook, errorSheet, '自定义方案');
		}
	},

	/**
	 * 添加自定义预设工作表
	 */
	async addCustomPresetsSheet(workbook: XLSX.WorkBook): Promise<void> {
		try {
			if (!isBrowser) {
				const emptySheet = XLSX.utils.aoa_to_sheet([['非浏览器环境，无法获取自定义预设']]);
				XLSX.utils.book_append_sheet(workbook, emptySheet, '自定义预设');
				return;
			}

			let hasData = false;
			const allPresetsData: Array<[string, string, string]> = [['类型', '名称', '说明']];

			// 处理每个自定义预设类型
			for (const key of CUSTOM_PRESETS_KEYS) {
				const storageKey = `${CUSTOM_PRESETS_PREFIX}${key}`;
				const presetJson = localStorage.getItem(storageKey);

				if (presetJson) {
					try {
						const presets = JSON.parse(presetJson);
						if (Array.isArray(presets) && presets.length > 0) {
							hasData = true;
							const typeName = key === 'origins' ? '产地' :
											key === 'processes' ? '处理法' :
											key === 'varieties' ? '品种' : key;

							presets.forEach((preset: string) => {
								allPresetsData.push([typeName, preset, `用户自定义的${typeName}`]);
							});
						}
					} catch {
						console.error(`解析自定义预设数据失败: ${key}`);
					}
				}
			}

			if (!hasData) {
				const emptySheet = XLSX.utils.aoa_to_sheet([['暂无自定义预设']]);
				XLSX.utils.book_append_sheet(workbook, emptySheet, '自定义预设');
				return;
			}

			// 创建工作表
			const worksheet = XLSX.utils.aoa_to_sheet(allPresetsData);

			// 设置列宽
			worksheet['!cols'] = [
				{ wch: 10 }, // 类型
				{ wch: 25 }, // 名称
				{ wch: 20 }  // 说明
			];

			XLSX.utils.book_append_sheet(workbook, worksheet, '自定义预设');

		} catch (error) {
			console.error('添加自定义预设工作表失败:', error);
			const errorSheet = XLSX.utils.aoa_to_sheet([['自定义预设数据导出失败', (error as Error).message]]);
			XLSX.utils.book_append_sheet(workbook, errorSheet, '自定义预设');
		}
	},

	/**
	 * 添加导出信息工作表
	 */
	addExportInfoSheet(workbook: XLSX.WorkBook): void {
		try {
			const exportInfo = [
				['导出信息', ''],
				['导出时间', new Date().toLocaleString()],
				['应用版本', APP_VERSION],
				['导出格式', 'Excel (.xlsx)'],
				['', ''],
				['工作表说明', ''],
				['咖啡豆', '包含所有咖啡豆的详细信息'],
				['冲煮记录', '包含所有冲煮记录和评价'],
				['应用设置', '包含用户的应用配置和偏好设置'],
				['自定义器具', '包含用户创建的自定义冲煮器具'],
				['自定义方案', '包含用户创建的自定义冲煮方案'],
				['自定义预设', '包含用户自定义的产地、处理法、品种等预设'],
			];

			// 创建工作表
			const worksheet = XLSX.utils.aoa_to_sheet(exportInfo);

			// 设置列宽
			worksheet['!cols'] = [
				{ wch: 20 }, // 项目
				{ wch: 40 }  // 内容
			];

			// 将导出信息工作表放在第一个位置
			XLSX.utils.book_append_sheet(workbook, worksheet, '导出信息');

			// 重新排序工作表，将导出信息放在第一位
			const sheetNames = workbook.SheetNames;
			const exportInfoIndex = sheetNames.indexOf('导出信息');
			if (exportInfoIndex > 0) {
				// 移动到第一位
				sheetNames.splice(exportInfoIndex, 1);
				sheetNames.unshift('导出信息');
				workbook.SheetNames = sheetNames;
			}

		} catch (error) {
			console.error('添加导出信息工作表失败:', error);
			// 即使失败也不影响其他数据的导出
		}
	}
};
