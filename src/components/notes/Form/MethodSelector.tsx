'use client'

import React, { useState, useEffect } from 'react'
import { Method, CustomEquipment } from '@/lib/core/config'
import { formatGrindSize, hasSpecificGrindScale, getGrindScaleUnit, parseGrindSize, combineGrindSize, findGrinder, getMyGrinders, smartConvertGrindSize } from '@/lib/utils/grindUtils'
import { getRecommendedGrinder, saveLastUsedGrinder } from '@/lib/utils/grinderRecommendation'
import { useGrinderRecommendationStore } from '@/lib/stores/grinderRecommendationStore'
import { SettingsOptions } from '@/components/settings/Settings'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/coffee-bean/ui/select'

interface MethodSelectorProps {
  selectedEquipment: string
  selectedMethod: string
  customMethods: Method[]
  commonMethods: Method[]
  onMethodSelect: (methodId: string) => void
  onParamsChange: (method: Method) => void
  settings?: SettingsOptions // 添加可选的设置参数
  customEquipments?: CustomEquipment[] // 添加自定义器具列表
}

const MethodSelector: React.FC<MethodSelectorProps> = ({
  selectedEquipment,
  selectedMethod,
  customMethods,
  commonMethods,
  onMethodSelect,
  onParamsChange,
  settings,
  customEquipments,
}) => {
  // 订阅 Zustand store 中的磨豆机推荐状态
  const lastUsedGrinderByEquipment = useGrinderRecommendationStore(
    state => state.lastUsedGrinderByEquipment
  );
  
  // 本地状态管理参数
  const [coffeeAmount, setCoffeeAmount] = useState<string>('15')
  const [ratioAmount, setRatioAmount] = useState<string>('15')
  const [waterAmount, setWaterAmount] = useState<string>('225g')
  const [grindSize, setGrindSize] = useState<string>('中细')
  
  // 使用智能推荐获取默认磨豆机（使用最新的 Zustand 状态）
  const getInitialGrinderId = () => {
    if (!settings) return 'generic'
    return getRecommendedGrinder(
      selectedEquipment || null,
      settings.myGrinders || ['generic'],
      lastUsedGrinderByEquipment, // 使用 Zustand store 的最新状态
      customEquipments
    )
  }
  
  const [selectedGrinderId, setSelectedGrinderId] = useState<string>(getInitialGrinderId())
  const [_tempValue, setTempValue] = useState<string>('92')

  // 处理咖啡粉量变化
  const handleCoffeeAmountChange = (value: string, method: Method) => {
    // 允许输入数字和小数点的正则表达式
    const regex = /^$|^[0-9]*\.?[0-9]*$/;
    if (regex.test(value)) {
      setCoffeeAmount(value)

      // 更新方法参数
      method.params.coffee = `${value}g`

      // 计算并更新水量
      if (value && ratioAmount && value !== '.') {
        const coffeeValue = parseFloat(value)
        const ratioValue = parseFloat(ratioAmount)

        if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
          const waterValue = coffeeValue * ratioValue
          // 四舍五入到整数
          const roundedWaterValue = Math.round(waterValue)
          method.params.water = `${roundedWaterValue}g`
          setWaterAmount(`${roundedWaterValue}g`)
        }
      }

      // 通知父组件参数已更改
      onParamsChange(method)
    }
  }

  // 处理水粉比变化
  const handleRatioAmountChange = (value: string, method: Method) => {
    // 允许输入数字和小数点的正则表达式
    const regex = /^$|^[0-9]*\.?[0-9]*$/;
    if (regex.test(value)) {
      setRatioAmount(value)

      // 更新方法参数
      method.params.ratio = `1:${value}`

      // 计算并更新水量
      if (coffeeAmount && value && value !== '.') {
        const coffeeValue = parseFloat(coffeeAmount)
        const ratioValue = parseFloat(value)

        if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
          const waterValue = coffeeValue * ratioValue
          // 四舍五入到整数
          const roundedWaterValue = Math.round(waterValue)
          method.params.water = `${roundedWaterValue}g`
          setWaterAmount(`${roundedWaterValue}g`)
        }
      }

      // 通知父组件参数已更改
      onParamsChange(method)
    }
  }

  // 处理水量变化
  const handleWaterAmountChange = (value: string, method: Method) => {
    // 允许输入数字和小数点的正则表达式
    const regex = /^$|^[0-9]*\.?[0-9]*$/;
    if (regex.test(value)) {
      setWaterAmount(value ? `${value}g` : '')

      // 更新方法参数
      method.params.water = value ? `${value}g` : '0g'

      // 根据水量和咖啡粉量计算水粉比
      if (coffeeAmount && value && value !== '.') {
        const coffeeValue = parseFloat(coffeeAmount)
        const waterValue = parseFloat(value)

        if (!isNaN(coffeeValue) && !isNaN(waterValue) && coffeeValue > 0) {
          const ratioValue = waterValue / coffeeValue
          // 保留一位小数
          const roundedRatioValue = Math.round(ratioValue * 10) / 10
          method.params.ratio = `1:${roundedRatioValue}`
          setRatioAmount(roundedRatioValue.toString())
        }
      }

      // 通知父组件参数已更改
      onParamsChange(method)
    }
  }

  // 处理研磨度变化
  const handleGrindSizeChange = (value: string, method: Method) => {
    setGrindSize(value)

    // 组合磨豆机ID和研磨度值
    const combinedGrindSize = combineGrindSize(selectedGrinderId, value)
    method.params.grindSize = combinedGrindSize

    // 通知父组件参数已更改
    onParamsChange(method)
  }

  // 处理磨豆机切换
  const handleGrinderChange = async (newGrinderId: string, method: Method) => {
    const oldGrinderId = selectedGrinderId
    setSelectedGrinderId(newGrinderId)

    // 使用智能转换函数
    const newGrindSizeValue = smartConvertGrindSize(
      grindSize,
      oldGrinderId,
      newGrinderId,
      settings?.customGrinders
    )
    
    // 更新显示的研磨度值
    setGrindSize(newGrindSizeValue)

    // 组合新的磨豆机ID和研磨度值
    const combinedGrindSize = combineGrindSize(newGrinderId, newGrindSizeValue)
    method.params.grindSize = combinedGrindSize
    
    // 记录用户的磨豆机选择（用于智能推荐）
    await saveLastUsedGrinder(
      selectedEquipment || null,
      newGrinderId,
      customEquipments
    )

    // 通知父组件参数已更改
    onParamsChange(method)
  }

  // 处理水温变化
  // 未使用的水温变更处理函数，可以在将来实现

  // 当用户在设置中更改磨豆机列表或选择器具时,更新默认磨豆机（使用智能推荐）
  useEffect(() => {
    // 只在没有选择方法时（新建笔记）或器具变化时更新默认磨豆机
    if (!selectedMethod && settings) {
      const oldGrinderId = selectedGrinderId
      const recommendedGrinderId = getRecommendedGrinder(
        selectedEquipment || null,
        settings.myGrinders || ['generic'],
        lastUsedGrinderByEquipment, // 使用 Zustand store 的最新状态
        customEquipments
      )
      
      // 如果推荐的磨豆机与当前不同，需要转化研磨度
      if (recommendedGrinderId !== oldGrinderId) {
        const newGrindSizeValue = smartConvertGrindSize(
          grindSize,
          oldGrinderId,
          recommendedGrinderId,
          settings.customGrinders
        )
        setGrindSize(newGrindSizeValue)
        setSelectedGrinderId(recommendedGrinderId)
      }
    }
  }, [settings, selectedMethod, selectedEquipment, customEquipments, selectedGrinderId, grindSize, lastUsedGrinderByEquipment])

  // 当选择的方法变化时，初始化参数
  useEffect(() => {
    if (selectedMethod) {
      // 在所有方案中查找选中的方案
      const allMethods = [...customMethods, ...commonMethods];
      const method = allMethods.find(m => m.id === selectedMethod || m.name === selectedMethod);

      if (method) {
        // 提取参数到本地状态
        const coffee = extractNumber(method.params.coffee)
        const ratio = extractRatioNumber(method.params.ratio)
        const temp = method.params.temp.replace('°C', '')

        setCoffeeAmount(coffee)
        setRatioAmount(ratio)
        setWaterAmount(method.params.water)
        
        // 解析研磨度，提取磨豆机ID和值
        const { grinderId, value } = parseGrindSize(method.params.grindSize)
        
        // 使用智能推荐获取默认磨豆机（如果研磨度没有携带磨豆机ID）
        const recommendedGrinderId = settings ? getRecommendedGrinder(
          selectedEquipment || null,
          settings.myGrinders || ['generic'],
          lastUsedGrinderByEquipment, // 使用 Zustand store 的最新状态
          customEquipments
        ) : 'generic'
        
        const actualGrinderId = grinderId || recommendedGrinderId
        setSelectedGrinderId(actualGrinderId)
        
        // 如果使用了推荐的磨豆机（即方案本身没有携带磨豆机ID），需要转化研磨度
        let finalGrindSize = value
        if (!grinderId && actualGrinderId !== 'generic') {
          // 将通用研磨度描述转换为推荐磨豆机的刻度
          finalGrindSize = smartConvertGrindSize(
            value,
            'generic', // 从通用描述转换
            actualGrinderId, // 转换到推荐的磨豆机
            settings?.customGrinders
          )
        }
        
        // 设置研磨度值
        setGrindSize(finalGrindSize)
        
        setTempValue(temp)
      }
    }
  }, [selectedMethod, customMethods, commonMethods, settings, selectedEquipment, customEquipments, lastUsedGrinderByEquipment])

  // 辅助函数：提取数字部分
  function extractNumber(str: string): string {
    const match = str.match(/(\d+(\.\d+)?)/);
    return match ? match[0] : '';
  }

  // 辅助函数：从水粉比中提取数字部分
  function extractRatioNumber(ratio: string): string {
    const match = ratio.match(/1:(\d+(\.\d+)?)/);
    return match ? match[1] : '';
  }

  // 判断方法是否选中
  const isMethodSelected = (method: Method) => {
    return selectedMethod === method.id || selectedMethod === method.name;
  }

  // 获取方案显示的研磨度（使用智能推荐的磨豆机）
  const getDisplayGrindSize = (method: Method): string => {
    if (!settings) return method.params.grindSize;
    
    // 解析方案的研磨度
    const { grinderId, value } = parseGrindSize(method.params.grindSize);
    
    // 如果方案已经携带了磨豆机ID，直接使用
    if (grinderId && grinderId !== 'generic') {
      return formatGrindSize(method.params.grindSize, settings.grindType, settings.customGrinders, { showGrinderName: true });
    }
    
    // 否则，使用智能推荐的磨豆机（使用最新的 Zustand 状态）
    const recommendedGrinderId = getRecommendedGrinder(
      selectedEquipment || null,
      settings.myGrinders || ['generic'],
      lastUsedGrinderByEquipment, // 使用 Zustand store 的最新状态
      customEquipments
    );
    
    // 如果推荐的是通用磨豆机，直接返回原值
    if (recommendedGrinderId === 'generic') {
      return value;
    }
    
    // 转换为推荐磨豆机的刻度
    const convertedValue = smartConvertGrindSize(
      value,
      'generic',
      recommendedGrinderId,
      settings.customGrinders
    );
    
    // 获取磨豆机名称
    const grinder = findGrinder(recommendedGrinderId, settings.customGrinders, true);
    const grinderName = grinder?.name || '通用';
    
    return `${grinderName} ${convertedValue}`;
  }

  // 创建分隔符
  const divider = (customMethods.length > 0 && commonMethods.length > 0) ? (
    <div className="py-3 flex items-center">
      <div className="grow h-px bg-neutral-200 dark:bg-neutral-800"></div>
      <span className="px-2 text-xs text-neutral-500 dark:text-neutral-400">通用方案</span>
      <div className="grow h-px bg-neutral-200 dark:bg-neutral-800"></div>
    </div>
  ) : null;

  // 渲染单个方案
  const renderMethod = (method: Method, isCustom: boolean) => {
    const isSelected = isMethodSelected(method);

    return (
      <div
        key={isCustom ? (method.id || method.name) : method.name}
        className="group relative"
      >
        <div
          className={`group relative border-l ${isSelected ? 'border-neutral-800 dark:border-white' : 'border-neutral-200 dark:border-neutral-800'} pl-6 cursor-pointer`}
          onClick={() => {
            // 统一优先使用ID作为标识符，确保一致性
            const methodIdentifier = method.id || method.name;
            onMethodSelect(methodIdentifier);
          }}
        >
          {isSelected && (
            <div className="absolute -left-px top-0 h-full w-px bg-neutral-800 dark:bg-white"></div>
          )}
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-3 min-w-0 overflow-hidden text-neutral-800 dark:text-neutral-100 ">
              <h3 className={`text-xs font-medium tracking-wider truncate`}>
                {method.name}
              </h3>
            </div>
          </div>

          {!isSelected && (
            <div className="mt-1.5 space-y-0.5 text-neutral-500 dark:text-neutral-400">
              <div className="flex items-center">
                <span className="text-xs font-medium w-14">咖啡粉:</span>
                <span className="text-xs font-medium">{method.params.coffee}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs font-medium w-14">水量:</span>
                <span className="text-xs font-medium">{method.params.water}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs font-medium w-14">粉水比:</span>
                <span className="text-xs font-medium">{method.params.ratio}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs font-medium w-14">研磨度:</span>
                <span className="text-xs font-medium">
                  {getDisplayGrindSize(method)}
                </span>
              </div>
            </div>
          )}

          {isSelected && (
            <div className="mt-2 pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-700" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-1.5">
                {/* 咖啡粉量 */}
                <div className="flex items-center">
                  <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">咖啡粉:</label>
                  <div className="flex items-baseline gap-0.5">
                    <input
                      type="text"
                      value={coffeeAmount}
                      onChange={(e) => handleCoffeeAmountChange(e.target.value, method)}
                      className="w-12 py-1 text-right text-xs font-medium text-neutral-800 dark:text-neutral-100 bg-transparent border-b border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 rounded-none"
                      placeholder="15"
                    />
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">g</span>
                  </div>
                </div>

                {/* 水量 - 可编辑 */}
                <div className="flex items-center">
                  <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">水量:</label>
                  <div className="flex items-baseline gap-0.5">
                    <input
                      type="text"
                      value={extractNumber(waterAmount)}
                      onChange={(e) => handleWaterAmountChange(e.target.value, method)}
                      className="w-14 py-1 text-right text-xs font-medium text-neutral-800 dark:text-neutral-100 bg-transparent border-b border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 rounded-none"
                      placeholder="225"
                    />
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">g</span>
                  </div>
                </div>

                {/* 粉水比 */}
                <div className="flex items-center">
                  <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">粉水比:</label>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">1:</span>
                    <input
                      type="text"
                      value={ratioAmount}
                      onChange={(e) => handleRatioAmountChange(e.target.value, method)}
                      className="w-10 py-1 text-xs font-medium text-neutral-800 dark:text-neutral-100 bg-transparent border-b border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 rounded-none"
                      placeholder="15"
                    />
                  </div>
                </div>

                {/* 研磨度 */}
                <div className="flex items-center">
                  <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">研磨度:</label>
                  <div className="flex items-center gap-1.5">
                    {/* 磨豆机选择器 */}
                    <Select value={selectedGrinderId} onValueChange={(value) => handleGrinderChange(value, method)}>
                      <SelectTrigger 
                        className="w-auto min-w-[60px] py-1 bg-transparent border-0 border-b border-neutral-200 dark:border-neutral-800 focus-within:border-neutral-400 dark:focus-within:border-neutral-600 shadow-none rounded-none h-auto px-0 text-xs text-neutral-800 dark:text-neutral-100 font-medium"
                      >
                        <SelectValue>
                          {findGrinder(selectedGrinderId, settings?.customGrinders, true)?.name || '通用'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[40vh] overflow-y-auto border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-xs bg-white/95 dark:bg-neutral-900/95 rounded-lg">
                        {/* 只显示用户添加的磨豆机 */}
                        {getMyGrinders(settings?.myGrinders || ['generic'], settings?.customGrinders).map((grinder) => (
                          <SelectItem key={grinder.id} value={grinder.id}>
                            {grinder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* 研磨度输入 */}
                    <input
                      type="text"
                      value={grindSize}
                      onChange={(e) => handleGrindSizeChange(e.target.value, method)}
                      className="w-16 py-1 text-xs font-medium text-neutral-800 dark:text-neutral-100 bg-transparent border-b border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 rounded-none"
                      placeholder={settings && hasSpecificGrindScale(selectedGrinderId) ? `8${getGrindScaleUnit(selectedGrinderId)}` : '中细'}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="py-3">
      <div>
        {selectedEquipment ? (
          <div className="space-y-5">
            {/* 自定义方案 */}
            {customMethods.length > 0 && (
              customMethods.map((method) => renderMethod(method, true))
            )}

            {/* 分隔符 */}
            {divider}

            {/* 通用方案 */}
            {commonMethods.length > 0 && (
              commonMethods.map((method) => renderMethod(method, false))
            )}

            {/* 没有方案时的提示 */}
            {customMethods.length === 0 && commonMethods.length === 0 && (
                <div className="text-xs text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-800 pl-6">
                  没有可用的冲煮方案，请前往“冲煮”页面添加
                </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-800 pl-6">
            请先选择器具
          </div>
        )}
      </div>
    </div>
  )
}

export default MethodSelector
