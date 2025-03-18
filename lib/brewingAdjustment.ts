// 咖啡萃取参数调整系统
// 基于专业咖啡理论的本地化参数调整工具

import { Stage } from "./config";

export interface TasteRatings {
	acidity: number;
	sweetness: number;
	bitterness: number;
	body: number;
}

export interface BrewingParameters {
	coffee: string;
	water: string;
	ratio: string;
	grindSize: string;
	temp: string;
	stages?: Stage[];
}

export interface AdjustmentFactors {
	grindSize: number; // 正值表示更细，负值表示更粗
	temperature: number; // 正值表示更高，负值表示更低
	ratio: number; // 正值表示更多咖啡（比例数字减小），负值表示更多水（比例数字增大）
	time: number; // 正值表示更长，负值表示更短
	pourSpeed: number; // 正值表示更慢，负值表示更快
}

// 提取数字的辅助函数
export const extractNumber = (str: string): number => {
	const match = str.match(/[\d.]+/);
	return match ? parseFloat(match[0]) : 0;
};

// 提取比例数字的辅助函数（如从"1:15"提取15）
export const extractRatioNumber = (ratioStr: string): number => {
	const match = ratioStr.match(/1:(\d+\.?\d*)/);
	return match ? parseFloat(match[1]) : 0;
};

// 格式化比例，保留整数或一位小数
export const formatRatio = (ratio: number): string => {
	return Number.isInteger(ratio) ? ratio.toString() : ratio.toFixed(1);
};

// 基于风味特征的萃取因子映射表
const extractionFactors = {
	// 研磨度影响因子
	grindSize: {
		coarser: {
			acidity: 0.3,
			sweetness: -0.2,
			bitterness: -0.4,
			body: -0.2,
		},
		finer: { acidity: -0.3, sweetness: 0.2, bitterness: 0.4, body: 0.2 },
	},
	// 水温影响因子
	temperature: {
		higher: { acidity: 0.2, sweetness: 0.3, bitterness: 0.4, body: 0.1 },
		lower: { acidity: -0.2, sweetness: -0.3, bitterness: -0.4, body: -0.1 },
	},
	// 萃取时间影响因子
	time: {
		longer: { acidity: -0.2, sweetness: 0.2, bitterness: 0.4, body: 0.3 },
		shorter: {
			acidity: 0.2,
			sweetness: -0.2,
			bitterness: -0.4,
			body: -0.3,
		},
	},
	// 粉水比影响因子
	ratio: {
		more_coffee: {
			acidity: 0.1,
			sweetness: 0.3,
			bitterness: 0.2,
			body: 0.4,
		},
		more_water: {
			acidity: -0.1,
			sweetness: -0.3,
			bitterness: -0.2,
			body: -0.4,
		},
	},
	// 注水速度影响因子
	pourSpeed: {
		slower: { acidity: -0.1, sweetness: 0.2, bitterness: 0.1, body: 0.2 },
		faster: { acidity: 0.1, sweetness: -0.2, bitterness: -0.1, body: -0.2 },
	},
};

// 计算需要调整的参数方向和幅度
export const calculateAdjustments = (
	currentTaste: TasteRatings,
	targetTaste: TasteRatings
): AdjustmentFactors => {
	// 计算风味差异
	const diff = {
		acidity: targetTaste.acidity - currentTaste.acidity,
		sweetness: targetTaste.sweetness - currentTaste.sweetness,
		bitterness: targetTaste.bitterness - currentTaste.bitterness,
		body: targetTaste.body - currentTaste.body,
	};

	// 初始化调整参数
	const adjustments: AdjustmentFactors = {
		grindSize: 0, // 正值表示更细，负值表示更粗
		temperature: 0, // 正值表示更高，负值表示更低
		ratio: 0, // 正值表示更多咖啡，负值表示更多水
		time: 0, // 正值表示更长，负值表示更短
		pourSpeed: 0, // 正值表示更慢，负值表示更快
	};

	// 基于酸度差异计算调整
	if (diff.acidity > 0) {
		adjustments.grindSize -= 0.3 * diff.acidity;
		adjustments.temperature -= 0.2 * diff.acidity;
		adjustments.time -= 0.2 * diff.acidity;
		adjustments.pourSpeed -= 0.1 * diff.acidity;
	} else if (diff.acidity < 0) {
		adjustments.grindSize += 0.3 * Math.abs(diff.acidity);
		adjustments.temperature += 0.2 * Math.abs(diff.acidity);
		adjustments.time += 0.2 * Math.abs(diff.acidity);
		adjustments.pourSpeed += 0.1 * Math.abs(diff.acidity);
	}

	// 基于甜度差异计算调整
	if (diff.sweetness > 0) {
		adjustments.grindSize += 0.2 * diff.sweetness;
		adjustments.temperature += 0.3 * diff.sweetness;
		adjustments.time += 0.2 * diff.sweetness;
		adjustments.ratio += 0.3 * diff.sweetness;
		adjustments.pourSpeed += 0.2 * diff.sweetness;
	} else if (diff.sweetness < 0) {
		adjustments.grindSize -= 0.2 * Math.abs(diff.sweetness);
		adjustments.temperature -= 0.3 * Math.abs(diff.sweetness);
		adjustments.time -= 0.2 * Math.abs(diff.sweetness);
		adjustments.ratio -= 0.3 * Math.abs(diff.sweetness);
		adjustments.pourSpeed -= 0.2 * Math.abs(diff.sweetness);
	}

	// 基于苦度差异计算调整
	if (diff.bitterness > 0) {
		adjustments.grindSize += 0.4 * diff.bitterness;
		adjustments.temperature += 0.4 * diff.bitterness;
		adjustments.time += 0.4 * diff.bitterness;
		adjustments.pourSpeed += 0.1 * diff.bitterness;
	} else if (diff.bitterness < 0) {
		adjustments.grindSize -= 0.4 * Math.abs(diff.bitterness);
		adjustments.temperature -= 0.4 * Math.abs(diff.bitterness);
		adjustments.time -= 0.4 * Math.abs(diff.bitterness);
		adjustments.pourSpeed -= 0.1 * Math.abs(diff.bitterness);
	}

	// 基于醇厚度差异计算调整
	if (diff.body > 0) {
		adjustments.grindSize += 0.2 * diff.body;
		adjustments.time += 0.3 * diff.body;
		adjustments.ratio += 0.4 * diff.body;
		adjustments.pourSpeed += 0.2 * diff.body;
	} else if (diff.body < 0) {
		adjustments.grindSize -= 0.2 * Math.abs(diff.body);
		adjustments.time -= 0.3 * Math.abs(diff.body);
		adjustments.ratio -= 0.4 * Math.abs(diff.body);
		adjustments.pourSpeed -= 0.2 * Math.abs(diff.body);
	}

	return adjustments;
};

// 研磨度描述映射表
const grindSizeMap: Record<string, number> = {
	"极细（面粉状）": 1,
	"很细（细砂糖）": 2,
	"细（白糖颗粒）": 3,
	"中细（白砂糖颗粒）": 4,
	"中等（细沙）": 5,
	"中粗（粗砂糖）": 6,
	"粗（细岩盐）": 7,
	"很粗（粗盐）": 8,
	"极粗（胡椒粒）": 9,
};

// 获取研磨度描述
const getGrindSizeDescription = (level: number): string => {
	const descriptions = Object.keys(grindSizeMap);
	// 确保level在有效范围内
	const normalizedLevel = Math.max(1, Math.min(9, Math.round(level)));
	return (
		descriptions.find((desc) => grindSizeMap[desc] === normalizedLevel) ||
		"中等（细沙）"
	);
};

// 根据当前研磨度描述获取对应的级别
const getGrindSizeLevel = (description: string): number => {
	return grindSizeMap[description] || 5; // 默认为中等
};

// 根据调整因子生成具体的参数调整建议
export const getParameterSuggestions = (
	currentParams: BrewingParameters,
	adjustments: AdjustmentFactors
): {
	params: BrewingParameters;
	explanations: Record<string, string>;
} => {
	const newParams = { ...currentParams };
	const explanations: Record<string, string> = {};

	// 研磨度调整
	if (Math.abs(adjustments.grindSize) > 0.5) {
		const currentLevel = getGrindSizeLevel(currentParams.grindSize);
		let newLevel = currentLevel;

		if (adjustments.grindSize > 0.5) {
			newLevel = currentLevel + (adjustments.grindSize > 1.0 ? 2 : 1);
			explanations.grindSize =
				"研磨度调整更细，增加萃取率，增强甜度和苦味";
		} else if (adjustments.grindSize < -0.5) {
			newLevel = currentLevel - (adjustments.grindSize < -1.0 ? 2 : 1);
			explanations.grindSize =
				"研磨度调整更粗，降低萃取率，增强酸度减少苦味";
		}

		newParams.grindSize = getGrindSizeDescription(newLevel);
	}

	// 温度调整
	if (Math.abs(adjustments.temperature) > 0.5) {
		const currentTemp = extractNumber(currentParams.temp);
		let newTemp = currentTemp;

		if (adjustments.temperature > 0.5) {
			newTemp = currentTemp + (adjustments.temperature > 1.0 ? 3 : 2);
			explanations.temp = "提高水温，增强萃取效率和甜度，适合深烘焙咖啡";
		} else if (adjustments.temperature < -0.5) {
			newTemp = currentTemp - (adjustments.temperature < -1.0 ? 3 : 2);
			explanations.temp =
				"降低水温，减缓萃取速度，减少苦味，适合浅烘焙咖啡";
		}

		// 确保温度在合理范围内
		newTemp = Math.max(80, Math.min(100, newTemp));
		newParams.temp = `${newTemp}°C`;
	}

	// 粉水比调整
	if (Math.abs(adjustments.ratio) > 0.5) {
		const currentRatio = extractRatioNumber(currentParams.ratio);
		let newRatio = currentRatio;

		if (adjustments.ratio > 0.5) {
			// 增加咖啡量，减小比例数字（如1:15 -> 1:14）
			newRatio = currentRatio - (adjustments.ratio > 1.0 ? 2 : 1);
			explanations.ratio = "增加咖啡粉与水的比例，增强体验、醇厚感和甜度";
		} else if (adjustments.ratio < -0.5) {
			// 减少咖啡量，增大比例数字（如1:15 -> 1:16）
			newRatio = currentRatio + (adjustments.ratio < -1.0 ? 2 : 1);
			explanations.ratio =
				"减少咖啡粉与水的比例，降低强度，减轻苦味和醇厚感";
		}

		// 确保比例在合理范围内
		newRatio = Math.max(10, Math.min(20, newRatio));
		newParams.ratio = `1:${formatRatio(newRatio)}`;

		// 更新咖啡粉量和水量，保持总水量不变
		const currentWater = extractNumber(currentParams.water);
		const newCoffee = Math.round(currentWater / newRatio);
		newParams.coffee = `${newCoffee}g`;
		newParams.water = `${currentWater}g`;
	}

	// 注水时间调整（通过调整stages实现）
	if (
		Math.abs(adjustments.time) > 0.5 &&
		currentParams.stages &&
		currentParams.stages.length > 0
	) {
		const stages = [...currentParams.stages];
		let timeAdjustmentFactor = 1;

		if (adjustments.time > 0.5) {
			// 延长时间
			timeAdjustmentFactor = adjustments.time > 1.0 ? 1.2 : 1.1;
			explanations.time = "延长总冲煮时间，增强萃取度和醇厚感";
		} else if (adjustments.time < -0.5) {
			// 缩短时间
			timeAdjustmentFactor = adjustments.time < -1.0 ? 0.8 : 0.9;
			explanations.time = "缩短总冲煮时间，降低萃取度，增强酸度";
		}

		// 更新每个阶段的时间
		let previousTime = 0;
		stages.forEach((stage, index) => {
			const stageDuration = stage.time - previousTime;
			const newDuration = Math.round(
				stageDuration * timeAdjustmentFactor
			);
			stage.time =
				index === 0
					? newDuration
					: stages[index - 1].time + newDuration;
			previousTime = stage.time;
		});

		newParams.stages = stages;
	}

	// 注水速度调整（通过调整pourTime实现）
	if (
		Math.abs(adjustments.pourSpeed) > 0.5 &&
		currentParams.stages &&
		currentParams.stages.length > 0
	) {
		const stages = [...currentParams.stages];
		let pourTimeAdjustmentFactor = 1;

		if (adjustments.pourSpeed > 0.5) {
			// 减慢注水速度
			pourTimeAdjustmentFactor = adjustments.pourSpeed > 1.0 ? 1.3 : 1.15;
			explanations.pourSpeed =
				"减慢注水速度，提高均匀性，增强甜度和层次感";
		} else if (adjustments.pourSpeed < -0.5) {
			// 加快注水速度
			pourTimeAdjustmentFactor =
				adjustments.pourSpeed < -1.0 ? 0.7 : 0.85;
			explanations.pourSpeed = "加快注水速度，减少过度萃取，增强清爽感";
		}

		// 更新每个阶段的注水时间
		stages.forEach((stage) => {
			if (stage.pourTime) {
				stage.pourTime = Math.round(
					stage.pourTime * pourTimeAdjustmentFactor
				);
			}
		});

		newParams.stages = stages;
	}

	return { params: newParams, explanations };
};

// 生成综合调整建议
export const generateAdjustmentAdvice = (
	currentParams: BrewingParameters,
	currentTaste: TasteRatings,
	targetTaste: TasteRatings
): {
	adjustedParams: BrewingParameters;
	explanations: Record<string, string>;
	generalAdvice: string;
} => {
	// 计算参数调整方向
	const adjustments = calculateAdjustments(currentTaste, targetTaste);

	// 获取具体参数调整建议
	const { params: adjustedParams, explanations } = getParameterSuggestions(
		currentParams,
		adjustments
	);

	// 计算风味差异来生成总体建议
	const diff = {
		acidity: targetTaste.acidity - currentTaste.acidity,
		sweetness: targetTaste.sweetness - currentTaste.sweetness,
		bitterness: targetTaste.bitterness - currentTaste.bitterness,
		body: targetTaste.body - currentTaste.body,
	};

	// 生成综合建议
	let generalAdvice = "根据您的理想风味，我们建议以下调整：\n\n";

	// 添加各个方面的调整说明
	Object.entries(explanations).forEach(([key, explanation]) => {
		generalAdvice += `- ${explanation}\n`;
	});

	// 添加整体萃取建议
	const isOverExtracted = diff.bitterness < 0 && diff.body < 0;
	const isUnderExtracted = diff.sweetness > 0 && diff.body > 0;

	if (isOverExtracted) {
		generalAdvice +=
			"\n总体而言，当前冲煮存在过度萃取的倾向，应减少萃取率。";
	} else if (isUnderExtracted) {
		generalAdvice += "\n总体而言，当前冲煮存在欠萃取的倾向，应增加萃取率。";
	} else {
		generalAdvice += "\n总体而言，需要进行精细调整以平衡各项风味属性。";
	}

	return {
		adjustedParams,
		explanations,
		generalAdvice,
	};
};
