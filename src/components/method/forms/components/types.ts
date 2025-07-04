import { Method } from '@/lib/core/config';

// 定义注水方式基本类型，普通器具和意式机共用的基础接口
export type BasePourType = string;

// 定义意式机特有的注水方式值，与config.ts中保持一致
export type EspressoPourTypeValues = 'extraction' | 'beverage' | 'other';

// 定义普通器具的注水方式枚举
export type RegularPourType = 'center' | 'circle' | 'ice' | 'bypass' | 'other' | string;

// 扩展基础的 Stage 类型，从config.ts中引用
import { Stage as BaseStage } from '@/lib/core/config';

// 扩展 Stage 类型，所有类型都使用pourType字段
export interface Stage extends BaseStage {
  // pourType可以是普通器具的类型，也可以是意式机的类型
  pourType?: RegularPourType | EspressoPourTypeValues;
}

// 修改 Method 接口以使用新的 Stage 类型
export interface MethodWithStages extends Omit<Method, 'params'> {
  params: {
    coffee: string;
    water: string;
    ratio: string;
    grindSize: string;
    temp: string;
    videoUrl: string;
    roastLevel?: string;
    stages: Stage[];
    // 意式机特有参数
    extractionTime?: number;
    liquidWeight?: string;
  };
}

// 表单步骤接口
export interface Step {
  name: string;
  component: React.ReactNode;
  id?: string;
} 