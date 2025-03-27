import { type Method, type Stage } from "@/lib/config";

// 定义Stage类型的接口，用于解析JSON
interface StageData {
	time?: number;
	pourTime?: number;
	label?: string;
	water?: string;
	detail?: string;
	pourType?: string;
	valveStatus?: string;
}

interface CoffeeBean {
	id?: string;
	name: string;
	origin?: string;
	roaster?: string;
	roastLevel: string;
	roastDate?: string;
	processingMethod?: string;
	process?: string;
	variety?: string;
	flavor?: string[];
	notes?: string;
	favorite?: boolean;
	timestamp?: number;
	capacity?: string;
	remaining?: string;
	price?: string;
	type?: string;
	blendComponents?: BlendComponent[] | undefined;
}

interface BrewingNote {
	id: string;
	beanId: string;
	methodId: string;
	methodName: string;
	equipment: string;
	date: string;
	method?: string;
	coffeeBeanInfo?: {
		name: string;
		roastLevel: string;
	};
	params: {
		coffee: string;
		water: string;
		ratio: string;
		grindSize: string;
		temp: string;
	};
	rating: number;
	notes: string;
	taste: {
		acidity: number;
		sweetness: number;
		bitterness: number;
		body: number;
	};
	brewTime?: string;
	timestamp: number;
}

// 定义BlendComponent接口
interface BlendComponent {
	percentage: string;
	origin?: string;
	process?: string;
	variety?: string;
	name?: string;
}

// 定义ParsedStage接口
interface ParsedStage {
	time: number;
	pourTime?: number;
	label: string;
	water: string;
	detail: string;
	pourType?: "center" | "circle" | "ice" | "other";
	valveStatus?: "open" | "closed";
}

/**
 * 将冲煮方案转换为优化用的JSON格式
 */
export function generateOptimizationJson(
	equipment: string,
	method: string,
	coffeeBeanInfo: {
		name: string;
		roastLevel: string;
		roastDate?: string;
	},
	params: {
		coffee: string;
		water: string;
		ratio: string;
		grindSize: string;
		temp: string;
	},
	stages: Stage[],
	currentTaste: {
		acidity: number;
		sweetness: number;
		bitterness: number;
		body: number;
	},
	idealTaste: {
		acidity: number;
		sweetness: number;
		bitterness: number;
		body: number;
	},
	notes: string,
	optimizationGoal: string
) {
	// 创建配置对象
	const configObject = {
		equipment,
		method,
		coffeeBeanInfo,
		params: {
			coffee: params.coffee,
			water: params.water,
			ratio: params.ratio,
			grindSize: params.grindSize,
			temp: params.temp,
			stages: stages || [],
		},
		currentTaste,
		idealTaste,
		notes,
		optimizationGoal,
	};

	// 返回格式化的JSON字符串
	return JSON.stringify(configObject, null, 2);
}

/**
 * 清理JSON字符串，移除不必要的包装
 * @param jsonString 可能需要清理的JSON字符串
 * @returns 清理后的JSON字符串
 */
export function cleanJsonString(jsonString: string): string {
	// 去除首尾空白字符
	let cleanedString = jsonString.trim();

	// 检查是否被```json和```包裹，如常见的复制格式
	if (cleanedString.startsWith("```json") && cleanedString.endsWith("```")) {
		cleanedString = cleanedString.slice(7, -3).trim();
	} else if (
		cleanedString.startsWith("```") &&
		cleanedString.endsWith("```")
	) {
		cleanedString = cleanedString.slice(3, -3).trim();
	}

	// 处理掐头掐尾的情况，即前后都有多余内容
	try {
		// 直接尝试解析，如果成功则无需进一步处理
		JSON.parse(cleanedString);
	} catch (_err) {
		// 如果解析失败，尝试查找有效的JSON部分

		// 1. 查找第一个 { 和最后一个 } 之间的内容
		const firstBrace = cleanedString.indexOf("{");
		const lastBrace = cleanedString.lastIndexOf("}");

		if (firstBrace >= 0 && lastBrace > firstBrace) {
			const potentialJson = cleanedString.slice(
				firstBrace,
				lastBrace + 1
			);

			try {
				// 验证提取的内容是否是有效的JSON
				JSON.parse(potentialJson);
				cleanedString = potentialJson;
				console.log("成功从文本中提取有效JSON");
			} catch (_extractErr) {
				// 如果提取的内容仍然不是有效的JSON，保持原样
				console.error("尝试提取JSON失败:", _extractErr);
			}
		}
	}

	return cleanedString;
}

/**
 * 从文本中提取数据
 * @param text 包含数据的文本
 * @returns 提取的JSON数据或null
 */
export function extractJsonFromText(
	text: string
): Method | CoffeeBean | BrewingNote | null {
	try {
		// 首先检查是否为自然语言格式的文本，避免【】符号导致JSON解析错误
		// 直接检查文本是否包含特定标识，而不是先尝试JSON解析
		const originalText = text.trim();

		// 检查是否是自然语言文本格式
		if (originalText.startsWith("【冲煮方案】")) {
			console.log("检测到冲煮方案文本格式");
			return parseMethodText(originalText);
		}

		if (originalText.startsWith("【咖啡豆】")) {
			console.log("检测到咖啡豆文本格式");
			return parseCoffeeBeanText(originalText);
		}

		if (originalText.startsWith("【冲煮记录】")) {
			console.log("检测到冲煮记录文本格式");
			return parseBrewingNoteText(originalText);
		}

		// 如果不是明确的文本格式，尝试按JSON处理
		const cleanedText = cleanJsonString(text);

		// 检查是否是普通JSON
		try {
			const jsonData = JSON.parse(cleanedText);
			console.log("JSON解析成功:", jsonData);

			// 尝试确定JSON类型，更灵活地处理不同的数据结构
			if (
				jsonData.params &&
				jsonData.params.stages &&
				Array.isArray(jsonData.params.stages)
			) {
				console.log("识别为标准Method类型");
				return jsonData as Method; // 标准Method类型
			} else if (jsonData.roastLevel || jsonData.processingMethod) {
				console.log("识别为CoffeeBean类型");
				return jsonData as CoffeeBean; // 可能是CoffeeBean类型
			} else if (jsonData.beanId && jsonData.methodId) {
				console.log("识别为BrewingNote类型");
				return jsonData as BrewingNote; // 可能是BrewingNote类型
			} else if (
				// 处理AI生成的更复杂的优化结构（method字段在最顶层）
				(jsonData.method || jsonData.coffeeBeanInfo) &&
				jsonData.params &&
				jsonData.params.stages &&
				Array.isArray(jsonData.params.stages)
			) {
				console.log("识别为AI生成的复杂方法类型，将转换为Method对象");
				// 直接构建Method对象
				const method: Method = {
					id: `${Date.now()}-${Math.random()
						.toString(36)
						.substr(2, 9)}`,
					name: jsonData.method || `${jsonData.equipment}优化方案`,
					params: jsonData.params,
				};

				// 确保返回的对象有名称
				if (!method.name) {
					method.name = `冲煮方案-${new Date().toLocaleDateString()}`;
				}

				console.log("转换后的Method对象:", method);
				return method;
			}

			// 如果无法识别具体类型，尝试使用parseMethodFromJson
			console.log("无法直接识别类型，尝试使用parseMethodFromJson");
			const method = parseMethodFromJson(cleanedText);
			if (method) {
				return method;
			}

			console.log("无法识别的JSON结构:", jsonData);
			return jsonData as Method | CoffeeBean | BrewingNote;
		} catch (err) {
			console.error("JSON解析错误:", err);
			// 不是有效JSON，继续尝试从文本中提取
		}

		// 增强自然语言格式检测 - 当JSON解析失败后进行
		// 尝试解析为冲煮记录格式
		if (
			cleanedText.includes("冲煮记录") ||
			cleanedText.includes("设备:") ||
			cleanedText.includes("方法:") ||
			cleanedText.includes("咖啡豆:") ||
			cleanedText.includes("参数设置:") ||
			cleanedText.includes("风味评分:")
		) {
			return parseBrewingNoteText(cleanedText);
		}

		// 尝试解析为冲煮方案格式
		if (
			cleanedText.includes("冲煮方案") ||
			cleanedText.includes("步骤 1:") ||
			cleanedText.includes("冲煮步骤") ||
			cleanedText.includes("分钟") ||
			(cleanedText.includes("咖啡粉量:") &&
				cleanedText.includes("水量:") &&
				cleanedText.includes("水温:"))
		) {
			return parseMethodText(cleanedText);
		}

		// 尝试解析为咖啡豆格式
		if (
			cleanedText.includes("咖啡豆") ||
			cleanedText.includes("烘焙度:") ||
			(cleanedText.includes("产地:") &&
				cleanedText.includes("处理法:")) ||
			cleanedText.includes("风味标签:")
		) {
			return parseCoffeeBeanText(cleanedText);
		}

		return null;
	} catch (err) {
		console.error("数据解析错误:", err);
		return null;
	}
}

/**
 * 从优化JSON中解析出Method对象
 */
export function parseMethodFromJson(jsonString: string): Method | null {
	try {
		// 清理输入的JSON字符串
		const cleanedJsonString = cleanJsonString(jsonString);

		// 解析JSON
		const parsedData = JSON.parse(cleanedJsonString);

		// 验证必要字段 - 更灵活地查找method字段
		const methodName =
			parsedData.method ||
			parsedData.coffeeBeanInfo?.method ||
			`${parsedData.equipment}优化方案`;

		if (!methodName && !parsedData.equipment) {
			throw new Error("导入的JSON缺少必要字段 (method)");
		}

		// 构建Method对象 - 始终生成新的ID，避免ID冲突
		const method: Method = {
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: methodName,
			params: {
				coffee: parsedData.params?.coffee || "15g",
				water: parsedData.params?.water || "225g",
				ratio: parsedData.params?.ratio || "1:15",
				grindSize: parsedData.params?.grindSize || "中细",
				temp: parsedData.params?.temp || "92°C",
				videoUrl: parsedData.params?.videoUrl || "",
				stages: [],
			},
		};

		// 处理stages
		if (
			parsedData.params?.stages &&
			Array.isArray(parsedData.params.stages)
		) {
			method.params.stages = parsedData.params.stages.map(
				(stage: StageData) => {
					// 确保pourType是有效的值
					let pourType = stage.pourType || "circle";
					if (
						!["center", "circle", "ice", "other"].includes(pourType)
					) {
						// 映射可能的pourType值
						if (pourType === "spiral") pourType = "circle";
						else pourType = "circle"; // 默认为circle
					}

					// 确保阀门状态是有效的值
					let valveStatus = stage.valveStatus || "";
					if (
						valveStatus &&
						!["open", "closed"].includes(valveStatus)
					) {
						valveStatus = ""; // 如果不是有效值，则设置为空
					}

					return {
						time: stage.time || 0,
						pourTime: stage.pourTime || 0,
						label: stage.label || "",
						water: stage.water || "",
						detail: stage.detail || "",
						pourType: pourType as
							| "center"
							| "circle"
							| "ice"
							| "other",
						valveStatus: valveStatus as "open" | "closed" | "",
					};
				}
			);
		}

		// 验证stages
		if (!method.params.stages || method.params.stages.length === 0) {
			throw new Error("导入的JSON缺少冲煮步骤");
		}

		// 强制确保name字段不为空
		if (!method.name) {
			method.name = `${parsedData.equipment || ""}优化冲煮方案`;
		}

		// 调试信息
		console.log("解析后的Method对象:", method);

		return method;
	} catch (err) {
		console.error("解析方法JSON出错:", err);
		return null;
	}
}

/**
 * 获取示例JSON
 */
export function getExampleJson() {
	return `{
  "equipment": "V60",
  "method": "改良分段式一刀流",
  "coffeeBeanInfo": {
    "name": "",
    "roastLevel": "中度烘焙",
    "roastDate": ""
  },
  "params": {
    "coffee": "15g",
    "water": "225g",
    "ratio": "1:15",
    "grindSize": "中细",
    "temp": "94°C",
    "videoUrl": "",
    "stages": [
      {
        "time": 30,
        "pourTime": 15,
        "label": "螺旋焖蒸",
        "water": "45g",
        "detail": "加大注水搅拌力度，充分激活咖啡粉层",
        "pourType": "circle"
      },
      {
        "time": 60,
        "pourTime": 20,
        "label": "快节奏中心注水",
        "water": "90g",
        "detail": "高水位快速注入加速可溶性物质释放",
        "pourType": "center"
      },
      {
        "time": 120,
        "pourTime": 30,
        "label": "分层绕圈注水",
        "water": "225g",
        "detail": "分三次间隔注水控制萃取节奏",
        "pourType": "circle"
      }
    ]
  },
  "currentTaste": {
    "acidity": 3,
    "sweetness": 3,
    "bitterness": 3,
    "body": 3
  },
  "idealTaste": {
    "acidity": 4,
    "sweetness": 4,
    "bitterness": 2,
    "body": 4
  },
  "notes": "",
  "optimizationGoal": "希望增加甜度和醇度，减少苦味，保持适中的酸度"
}`;
}

/**
 * 清理JSON数据，移除不必要的字段
 */
export function cleanJsonForOptimization(jsonString: string): string {
	try {
		const data = JSON.parse(jsonString);

		// 定义Stage类型，用于类型安全
		interface CleanStage {
			time?: number;
			pourTime?: number;
			label?: string;
			water?: string;
			detail?: string;
			pourType?: string;
			valveStatus?: string;
		}

		// 保留必要的字段
		const cleanedData = {
			equipment: data.equipment,
			method: data.method,
			params: {
				coffee: data.params?.coffee,
				water: data.params?.water,
				ratio: data.params?.ratio,
				grindSize: data.params?.grindSize,
				temp: data.params?.temp,
				stages: data.params?.stages?.map((stage: CleanStage) => ({
					time: stage.time,
					pourTime: stage.pourTime,
					label: stage.label,
					water: stage.water,
					detail: stage.detail,
					pourType: stage.pourType,
					valveStatus: stage.valveStatus,
				})),
			},
			currentTaste: data.currentTaste,
			idealTaste: data.idealTaste,
			notes: data.notes,
			optimizationGoal: data.optimizationGoal,
		};

		return JSON.stringify(cleanedData, null, 2);
	} catch (_err) {
		return jsonString;
	}
}

/**
 * 将Method对象转换为JSON字符串，用于分享
 */
export function methodToJson(method: Method): string {
	// 创建配置对象
	const configObject = {
		method: method.name,
		params: {
			coffee: method.params.coffee,
			water: method.params.water,
			ratio: method.params.ratio,
			grindSize: method.params.grindSize,
			temp: method.params.temp,
			stages: method.params.stages || [],
		},
	};

	// 返回格式化的JSON字符串
	return JSON.stringify(configObject, null, 2);
}

/**
 * 生成咖啡豆识别模板JSON
 * 用于生成AI识别咖啡豆图片的提示词
 */
export function generateBeanTemplateJson() {
	return `{
  "id": "",
  "name": "",
  "image": "",
  "price": "",
  "capacity": "",
  "remaining": "",
  "roastLevel": "浅度烘焙",
  "roastDate": "",
  "flavor": [],
  "origin": "",
  "process": "",
  "variety": "",
  "type": "",
  "notes": ""
}`;
}

/**
 * 将咖啡豆对象转换为可读文本格式
 * @param bean 咖啡豆对象
 * @returns 格式化的可读文本
 */
export function beanToReadableText(bean: CoffeeBean): string {
	const {
		name,
		capacity,
		remaining,
		roastLevel,
		roastDate,
		flavor,
		origin,
		process,
		variety,
		price,
		type,
		notes,
		blendComponents,
	} = bean;

	// 构建可读文本
	let text = `【咖啡豆】${name}\n`;
	text += `容量: ${capacity}g${
		remaining !== capacity ? ` (剩余${remaining}g)` : ""
	}\n`;
	text += `烘焙度: ${roastLevel || "未知"}\n`;

	if (roastDate) text += `烘焙日期: ${roastDate}\n`;
	if (origin) text += `产地: ${origin}\n`;
	if (process) text += `处理法: ${process}\n`;
	if (variety) text += `品种: ${variety}\n`;
	if (type) text += `类型: ${type}\n`;
	if (price) text += `价格: ${price}元\n`;

	if (flavor && flavor.length > 0) {
		text += `风味标签: ${flavor.join(", ")}\n`;
	}

	if (blendComponents && Array.isArray(blendComponents)) {
		text += "\n拼配成分:\n";
		blendComponents.forEach((comp: BlendComponent, index: number) => {
			const details = [];
			if (comp.origin) details.push(comp.origin);
			if (comp.process) details.push(comp.process);
			if (comp.variety) details.push(comp.variety);

			text += `  ${index + 1}. ${comp.percentage}% ${details.join(
				" | "
			)}\n`;
		});
	}

	if (notes) text += `\n备注: ${notes}\n`;

	// 添加导入提示
	text += "\n--- 复制以上内容可分享和导入 ---";

	// 添加隐藏的序列化标识
	text += `\n\n@DATA_TYPE:COFFEE_BEAN@`;

	return text;
}

/**
 * 将冲煮方案对象转换为可读文本格式
 * @param method 冲煮方案对象
 * @returns 格式化的可读文本
 */
export function methodToReadableText(method: Method): string {
	const { name, params } = method;

	// 构建可读文本
	let text = `【冲煮方案】${name}\n\n`;
	text += `咖啡粉量: ${params.coffee || "未设置"}\n`;
	text += `水量: ${params.water || "未设置"}\n`;
	text += `比例: ${params.ratio || "未设置"}\n`;
	text += `研磨度: ${params.grindSize || "未设置"}\n`;
	text += `水温: ${params.temp || "未设置"}\n`;

	if (params.stages && params.stages.length > 0) {
		text += "\n冲煮步骤:\n\n";
		params.stages.forEach((stage: ParsedStage, index: number) => {
			const timeText = `${Math.floor(stage.time / 60)}分${
				stage.time % 60
			}秒`;

			// 分别生成注水时间和注水方式文本
			let pourTimeText = "";
			if (stage.pourTime) {
				pourTimeText = ` (注水${stage.pourTime}秒)`;
			}

			let pourTypeText = "";
			if (stage.pourType) {
				pourTypeText = ` [${getPourTypeText(stage.pourType)}]`;
			}

			// 确保标签和详情是分开的
			text += `${
				index + 1
			}. [${timeText}]${pourTimeText}${pourTypeText} ${stage.label} - ${
				stage.water
			}\n`;

			if (stage.detail) {
				text += `   ${stage.detail}\n`;
			}

			text += "\n"; // 每个步骤后添加空行
		});
	}

	// 添加导入提示
	text += "--- 复制以上内容可分享和导入 ---";

	// 添加隐藏的序列化标识
	text += `\n\n@DATA_TYPE:BREWING_METHOD@`;

	return text;
}

// 添加一个辅助函数来获取注水方式的文本描述
function getPourTypeText(pourType: string): string {
	switch (pourType) {
		case "center":
			return "中心注水";
		case "circle":
			return "绕圈注水";
		case "ice":
			return "冰块注水";
		case "other":
			return "其他方式";
		default:
			return "绕圈注水";
	}
}

/**
 * 将冲煮记录对象转换为可读文本格式
 * @param note 冲煮记录对象
 * @returns 格式化的可读文本
 */
export function brewingNoteToReadableText(note: BrewingNote): string {
	const { equipment, method, params, coffeeBeanInfo, rating, taste, notes } =
		note;

	// 构建可读文本
	let text = `【冲煮记录】\n`;
	text += `设备: ${equipment || "未设置"}\n`;
	text += `方法: ${method || "未设置"}\n`;
	text += `咖啡豆: ${coffeeBeanInfo?.name || "未设置"}\n`;
	text += `烘焙度: ${coffeeBeanInfo?.roastLevel || "未设置"}\n`;

	if (params) {
		text += `\n参数设置:\n`;
		text += `咖啡粉量: ${params.coffee || "未设置"}\n`;
		text += `水量: ${params.water || "未设置"}\n`;
		text += `比例: ${params.ratio || "未设置"}\n`;
		text += `研磨度: ${params.grindSize || "未设置"}\n`;
		text += `水温: ${params.temp || "未设置"}\n`;
	}

	if (taste) {
		text += `\n风味评分:\n`;
		text += `酸度: ${taste.acidity || 0}/5\n`;
		text += `甜度: ${taste.sweetness || 0}/5\n`;
		text += `苦度: ${taste.bitterness || 0}/5\n`;
		text += `醇厚度: ${taste.body || 0}/5\n`;
	}

	if (rating) {
		text += `\n综合评分: ${rating}/5\n`;
	}

	if (notes) {
		text += `\n笔记:\n${notes}\n`;
	}

	// 添加导入提示
	text += "\n--- 复制全部内容可分享和导入 ---";

	// 添加隐藏的序列化标识（不再包含JSON）
	text += `\n\n@DATA_TYPE:BREWING_NOTE@`;

	return text;
}

/**
 * 从自然语言文本中解析咖啡豆数据
 * @param text 咖啡豆的文本描述
 * @returns 结构化的咖啡豆数据
 */
function parseCoffeeBeanText(text: string): CoffeeBean | null {
	const bean: CoffeeBean = {
		name: "",
		capacity: "",
		remaining: "",
		roastLevel: "浅度烘焙",
		flavor: [],
	};

	// 提取名称
	const nameMatch = text.match(/【咖啡豆】(.*?)(?:\n|$)/);
	if (nameMatch && nameMatch[1]) {
		bean.name = nameMatch[1].trim();
	}

	// 提取容量
	const capacityMatch = text.match(/容量:\s*(\d+)g/);
	if (capacityMatch && capacityMatch[1]) {
		bean.capacity = capacityMatch[1];
	}

	// 提取剩余容量
	const remainingMatch = text.match(/剩余(\d+)g/);
	if (remainingMatch && remainingMatch[1]) {
		bean.remaining = remainingMatch[1];
	} else if (bean.capacity) {
		bean.remaining = bean.capacity;
	}

	// 提取烘焙度
	const roastMatch = text.match(/烘焙度:\s*(.*?)(?:\n|$)/);
	if (roastMatch && roastMatch[1] && roastMatch[1] !== "未知") {
		bean.roastLevel = roastMatch[1].trim();
	}

	// 提取烘焙日期
	const dateMatch = text.match(/烘焙日期:\s*(.*?)(?:\n|$)/);
	if (dateMatch && dateMatch[1]) {
		bean.roastDate = dateMatch[1].trim();
	}

	// 提取产地
	const originMatch = text.match(/产地:\s*(.*?)(?:\n|$)/);
	if (originMatch && originMatch[1]) {
		bean.origin = originMatch[1].trim();
	}

	// 提取处理法
	const processMatch = text.match(/处理法:\s*(.*?)(?:\n|$)/);
	if (processMatch && processMatch[1]) {
		bean.process = processMatch[1].trim();
	}

	// 提取品种
	const varietyMatch = text.match(/品种:\s*(.*?)(?:\n|$)/);
	if (varietyMatch && varietyMatch[1]) {
		bean.variety = varietyMatch[1].trim();
	}

	// 提取类型
	const typeMatch = text.match(/类型:\s*(.*?)(?:\n|$)/);
	if (typeMatch && typeMatch[1]) {
		bean.type = typeMatch[1].trim();
	}

	// 提取价格
	const priceMatch = text.match(/价格:\s*(\d+)元/);
	if (priceMatch && priceMatch[1]) {
		bean.price = priceMatch[1];
	}

	// 提取风味
	const flavorMatch = text.match(/风味标签:\s*(.*?)(?:\n|$)/);
	if (flavorMatch && flavorMatch[1]) {
		bean.flavor = flavorMatch[1].split(",").map((f: string) => f.trim());
	}

	// 提取备注
	const notesMatch = text.match(/备注:\s*(.*?)(?:\n|$)/);
	if (notesMatch && notesMatch[1]) {
		bean.notes = notesMatch[1].trim();
	}

	// 提取拼配成分（如果有）
	if (text.includes("拼配成分:")) {
		bean.blendComponents = [];
		const blendSection = text.split("拼配成分:")[1].split("\n---")[0];
		const components = blendSection.match(/\d+\.\s*(.*?)\s*\((\d+)%\)/g);

		if (components) {
			components.forEach((comp: string) => {
				// 先确保blendComponents不是undefined
				if (!bean.blendComponents) {
					bean.blendComponents = [];
				}

				const compMatch = comp.match(/\d+\.\s*(.*?)\s*\((\d+)%\)/);
				if (compMatch && compMatch[1] && compMatch[2]) {
					bean.blendComponents.push({
						name: compMatch[1].trim(),
						percentage: String(parseInt(compMatch[2])), // 转为字符串类型
					});
				}
			});
		}
	}

	return bean;
}

/**
 * 从自然语言文本中解析冲煮方案数据
 * @param text 冲煮方案的文本描述
 * @returns 结构化的冲煮方案数据
 */
function parseMethodText(text: string): Method | null {
	const method: Method = {
		id: `method-${Date.now()}`,
		name: "",
		params: {
			coffee: "",
			water: "",
			ratio: "",
			grindSize: "",
			temp: "",
			videoUrl: "",
			stages: [],
		},
	};

	// 提取名称
	const nameMatch = text.match(/【冲煮方案】(.*?)(?:\n|$)/);
	if (nameMatch && nameMatch[1]) {
		method.name = nameMatch[1].trim();
	}

	// 提取参数
	const coffeeMatch = text.match(/咖啡粉量:\s*(.*?)(?:\n|$)/);
	if (coffeeMatch && coffeeMatch[1] && coffeeMatch[1] !== "未设置") {
		method.params.coffee = coffeeMatch[1].trim();
	}

	const waterMatch = text.match(/水量:\s*(.*?)(?:\n|$)/);
	if (waterMatch && waterMatch[1] && waterMatch[1] !== "未设置") {
		method.params.water = waterMatch[1].trim();
	}

	const ratioMatch = text.match(/比例:\s*(.*?)(?:\n|$)/);
	if (ratioMatch && ratioMatch[1] && ratioMatch[1] !== "未设置") {
		method.params.ratio = ratioMatch[1].trim();
	}

	const grindMatch = text.match(/研磨度:\s*(.*?)(?:\n|$)/);
	if (grindMatch && grindMatch[1] && grindMatch[1] !== "未设置") {
		method.params.grindSize = grindMatch[1].trim();
	}

	const tempMatch = text.match(/水温:\s*(.*?)(?:\n|$)/);
	if (tempMatch && tempMatch[1] && tempMatch[1] !== "未设置") {
		method.params.temp = tempMatch[1].trim();
	}

	// 尝试提取ID（如果有）
	const idMatch = text.match(/@METHOD_ID:(method-[a-zA-Z0-9-]+)@/);
	if (idMatch && idMatch[1]) {
		method.id = idMatch[1];
	}

	// 提取冲煮步骤
	if (text.includes("冲煮步骤:")) {
		const stagesSection = text.split("冲煮步骤:")[1].split("\n---")[0];
		const stageLines = stagesSection
			.split("\n")
			.filter((line) => line.trim() !== "");

		// 分组解析步骤和详细信息
		for (let i = 0; i < stageLines.length; i++) {
			const line = stageLines[i];
			// 如果是主步骤行
			if (line.match(/^\d+\.\s*\[.*?\]/)) {
				// 修改正则表达式以正确提取各部分
				const stageMatch = line.match(
					/\d+\.\s*\[(\d+)分(\d+)秒\](?:\s*\(注水(\d+)秒\))?(?:\s*\[(.*?)\])?\s*(.*?)\s*-\s*(.*?)(?:\n|$)/
				);
				if (stageMatch) {
					const minutes = parseInt(stageMatch[1]);
					const seconds = parseInt(stageMatch[2]);
					const time = minutes * 60 + seconds;
					const pourTime = stageMatch[3]
						? parseInt(stageMatch[3])
						: Math.min(20, Math.ceil(time * 0.25));
					const pourTypeText = stageMatch[4] || "";
					const label = stageMatch[5].trim();
					const water = stageMatch[6].trim();

					// 从注水方式文本推断pourType
					let pourType = "circle"; // 默认为绕圈注水
					if (pourTypeText) {
						if (pourTypeText.includes("中心")) {
							pourType = "center";
						} else if (
							pourTypeText.includes("冰块") ||
							pourTypeText.includes("冰")
						) {
							pourType = "ice";
						} else if (pourTypeText.includes("其他")) {
							pourType = "other";
						}
					}

					let detail = "";

					// 检查下一行是否是详细信息 - 通过检查是否有缩进（以空格开头）
					if (
						i + 1 < stageLines.length &&
						stageLines[i + 1].startsWith(" ")
					) {
						detail = stageLines[i + 1].trim();
						i++; // 跳过详细信息行
					}

					const stage: ParsedStage = {
						time,
						pourTime,
						label,
						water,
						detail,
						pourType: pourType as
							| "center"
							| "circle"
							| "ice"
							| "other",
					};

					method.params.stages.push(stage);
				}
			}
		}
	}

	return method;
}

/**
 * 从自然语言文本中解析冲煮记录数据
 * @param text 冲煮记录的文本描述
 * @returns 结构化的冲煮记录数据
 */
function parseBrewingNoteText(text: string): BrewingNote | null {
	const note: BrewingNote = {
		id: `note-${Date.now()}`,
		beanId: "",
		methodId: "",
		methodName: "",
		equipment: "",
		date: "",
		params: {
			coffee: "",
			water: "",
			ratio: "",
			grindSize: "",
			temp: "",
		},
		rating: 0,
		notes: "",
		taste: {
			acidity: 0,
			sweetness: 0,
			bitterness: 0,
			body: 0,
		},
		timestamp: Date.now(),
	};

	// 提取设备
	const equipmentMatch = text.match(/设备:\s*(.*?)(?:\n|$)/);
	if (equipmentMatch && equipmentMatch[1] && equipmentMatch[1] !== "未设置") {
		note.equipment = equipmentMatch[1].trim();
	}

	// 提取方法
	const methodMatch = text.match(/方法:\s*(.*?)(?:\n|$)/);
	if (methodMatch && methodMatch[1] && methodMatch[1] !== "未设置") {
		note.methodName = methodMatch[1].trim();
	}

	// 提取咖啡豆信息
	const beanMatch = text.match(/咖啡豆:\s*(.*?)(?:\n|$)/);
	if (beanMatch && beanMatch[1] && beanMatch[1] !== "未设置") {
		note.beanId = beanMatch[1].trim();
	}

	// 提取参数
	if (text.includes("参数设置:")) {
		const coffeeMatch = text.match(/咖啡粉量:\s*(.*?)(?:\n|$)/);
		if (coffeeMatch && coffeeMatch[1] && coffeeMatch[1] !== "未设置") {
			note.params.coffee = coffeeMatch[1].trim();
		}

		const waterMatch = text.match(/水量:\s*(.*?)(?:\n|$)/);
		if (waterMatch && waterMatch[1] && waterMatch[1] !== "未设置") {
			note.params.water = waterMatch[1].trim();
		}

		const ratioMatch = text.match(/比例:\s*(.*?)(?:\n|$)/);
		if (ratioMatch && ratioMatch[1] && ratioMatch[1] !== "未设置") {
			note.params.ratio = ratioMatch[1].trim();
		}

		const grindMatch = text.match(/研磨度:\s*(.*?)(?:\n|$)/);
		if (grindMatch && grindMatch[1] && grindMatch[1] !== "未设置") {
			note.params.grindSize = grindMatch[1].trim();
		}

		const tempMatch = text.match(/水温:\s*(.*?)(?:\n|$)/);
		if (tempMatch && tempMatch[1] && tempMatch[1] !== "未设置") {
			note.params.temp = tempMatch[1].trim();
		}
	}

	// 提取风味评分
	if (text.includes("风味评分:")) {
		const acidityMatch = text.match(/酸度:\s*(\d+)\/5/);
		if (acidityMatch && acidityMatch[1]) {
			note.taste.acidity = parseInt(acidityMatch[1]);
		}

		const sweetnessMatch = text.match(/甜度:\s*(\d+)\/5/);
		if (sweetnessMatch && sweetnessMatch[1]) {
			note.taste.sweetness = parseInt(sweetnessMatch[1]);
		}

		const bitternessMatch = text.match(/苦度:\s*(\d+)\/5/);
		if (bitternessMatch && bitternessMatch[1]) {
			note.taste.bitterness = parseInt(bitternessMatch[1]);
		}

		const bodyMatch = text.match(/醇厚度:\s*(\d+)\/5/);
		if (bodyMatch && bodyMatch[1]) {
			note.taste.body = parseInt(bodyMatch[1]);
		}
	}

	// 提取综合评分
	const ratingMatch = text.match(/综合评分:\s*(\d+)\/5/);
	if (ratingMatch && ratingMatch[1]) {
		note.rating = parseInt(ratingMatch[1]);
	}

	// 提取笔记
	if (text.includes("笔记:")) {
		const notesSection = text.split("笔记:")[1].split("\n---")[0];
		note.notes = notesSection.trim();
	}

	return note;
}
