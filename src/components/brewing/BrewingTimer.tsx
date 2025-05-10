"use client";

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrewingNoteForm } from "@/components/notes";
import type { BrewingNoteData, CoffeeBean } from "@/types/app";
import type { Method, Stage } from "@/lib/core/config";
import type { SettingsOptions } from "@/components/settings/Settings";
import hapticsUtils from "@/lib/ui/haptics";
import { Storage } from "@/lib/core/storage";
import { equipmentList } from "@/lib/core/config";
import { 
  BrewingTimerSettings, 
  formatTime, 
  handleScreenWake, 
  cleanupScreenWake,
  calculateTargetFlowRate,
  // 音频模块
  createInitialAudioState, 
  initAudioSystem, 
  cleanupAudioSystem, 
  playSound,
  // 阶段处理器
  createExpandedStages,
  getCurrentStageIndex,
  getStageProgress,
  calculateCurrentWater,
  // 计时器控制器
  startMainTimer as startTimerController,
} from "@/components/brewing/Timer";
import type { 
  ExpandedStage, 
  LayoutSettings,
  AudioState,
  TimerCallbacks,
} from "@/components/brewing/Timer";

// 保留布局设置接口的导出，但使用从Timer模块导入的定义
export type { LayoutSettings } from "@/components/brewing/Timer";
// 导出这些在导入中被定义但未使用的函数，避免linter错误
export { getStageProgress, calculateCurrentWater };

interface BrewingTimerProps {
  currentBrewingMethod: Method | null;
  onTimerComplete?: () => void;
  onStatusChange?: (status: { isRunning: boolean }) => void;
  onStageChange?: (status: {
    currentStage: number;
    progress: number;
    isWaiting: boolean;
  }) => void;
  onComplete?: (isComplete: boolean, totalTime?: number) => void;
  onCountdownChange?: (time: number | null) => void;
  onExpandedStagesChange?: (
    stages: {
      type: "pour" | "wait";
      label: string;
      startTime: number;
      endTime: number;
      time: number;
      pourTime?: number;
      water: string;
      detail: string;
      pourType?: string;
      valveStatus?: "open" | "closed";
      originalIndex: number;
    }[]
  ) => void;
  onShowNoteForm?: (data: Partial<BrewingNoteData>) => void;
  settings: SettingsOptions;
  selectedEquipment: string | null;
  isCoffeeBrewed?: boolean;
  layoutSettings?: LayoutSettings; // 添加布局设置选项
}

const BrewingTimer: React.FC<BrewingTimerProps> = ({
  currentBrewingMethod,
  onTimerComplete,
  onStatusChange,
  onStageChange,
  onComplete,
  onCountdownChange,
  onExpandedStagesChange,
  onShowNoteForm,
  settings,
  selectedEquipment,
  isCoffeeBrewed,
  layoutSettings = {}, // 使用空对象作为默认值
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [currentWaterAmount, setCurrentWaterAmount] = useState(0);
  const [countdownTime, setCountdownTime] = useState<number | null>(null);
  const [hasStartedOnce, setHasStartedOnce] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isHapticsSupported, setIsHapticsSupported] = useState(false);
  const [isProgressBarReady, setIsProgressBarReady] = useState(false);
  const lastStageRef = useRef<number>(-1);
  // 添加一个引用来记录上一次的倒计时状态，避免重复触发事件
  const prevCountdownTimeRef = useRef<number | null>(null);

  // 创建扩展阶段数组的引用
  const expandedStagesRef = useRef<ExpandedStage[]>([]);

  // 当前扩展阶段索引
  const [currentExpandedStageIndex, setCurrentExpandedStageIndex] =
    useState(-1);

  const audioState = useRef<AudioState>(createInitialAudioState());

  const methodStagesRef = useRef(currentBrewingMethod?.params.stages || []);

  // 保留必要的状态但移除笔记表单状态
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localLayoutSettings, setLocalLayoutSettings] = useState<LayoutSettings>(layoutSettings);
  const [localShowFlowRate, setLocalShowFlowRate] = useState(settings.showFlowRate);

  // 监听布局设置变化
  useEffect(() => {
    setLocalLayoutSettings(layoutSettings);
  }, [layoutSettings]);

  // 监听流速显示设置变化
  useEffect(() => {
    setLocalShowFlowRate(settings.showFlowRate);
  }, [settings.showFlowRate]);

  // 处理布局设置变化
  const handleLayoutChange = useCallback((newSettings: LayoutSettings) => {
    // 首先更新本地状态
    setLocalLayoutSettings(newSettings);

    // 然后派发事件，通知其他组件
    window.dispatchEvent(
      new CustomEvent("brewing:layoutChange", {
        detail: { layoutSettings: newSettings },
      })
    );
  }, []);

  // 处理流速显示设置变化
  const handleFlowRateSettingChange = useCallback((showFlowRate: boolean) => {
    // 更新本地状态
    setLocalShowFlowRate(showFlowRate);
    
    // 发送事件通知父组件更新设置
    window.dispatchEvent(
      new CustomEvent("brewing:settingsChange", {
        detail: {
          showFlowRate: showFlowRate,
        },
      })
    );

    // 将更新保存到 Storage 以确保持久化
    const updateSettings = async () => {
      try {
        // 先获取当前设置
        const currentSettingsStr = await Storage.get('brewGuideSettings');
        if (currentSettingsStr) {
          const currentSettings = JSON.parse(currentSettingsStr);
          // 更新 showFlowRate 设置
          const newSettings = { ...currentSettings, showFlowRate };
          // 保存回存储
          await Storage.set('brewGuideSettings', JSON.stringify(newSettings));
        }
      } catch (error) {
        console.error('保存流速设置失败', error);
      }
    };
    
    updateSettings();
  }, []);

  // 检查设备是否支持触感反馈
  useEffect(() => {
    const checkHapticsSupport = async () => {
      const supported = await hapticsUtils.isSupported();
      setIsHapticsSupported(supported);
    };

    checkHapticsSupport();
  }, []);

  // 封装触感调用函数
  const triggerHaptic = useCallback(
    async (type: keyof typeof hapticsUtils) => {
      if (
        isHapticsSupported &&
        settings.hapticFeedback &&
        typeof hapticsUtils[type] === "function"
      ) {
        await hapticsUtils[type]();
      }
    },
    [isHapticsSupported, settings.hapticFeedback]
  );

  // 音频系统初始化
  useEffect(() => {
    // 初始化音频系统
    const setup = async () => {
      audioState.current = await initAudioSystem(audioState.current);
    };
    
    setup();

    // 添加用户交互事件监听器
    const handleUserInteraction = () => {
      if (audioState.current.audioContext?.state === "suspended") {
        audioState.current.audioContext.resume();
      }
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
    };

    document.addEventListener("click", handleUserInteraction);
    document.addEventListener("touchstart", handleUserInteraction);

    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
      cleanupAudioSystem(audioState.current);
    };
  }, []);

  const playSoundEffect = useCallback(
    (type: "start" | "ding" | "correct") => {
      playSound(type, audioState.current, settings.notificationSound);
    },
    [settings.notificationSound]
  );

  // 导入并使用StageProcessor模块的createExpandedStages函数替换原有实现
  const processExpansion = useCallback(() => {
    if (!currentBrewingMethod?.params?.stages) return [];
    return createExpandedStages(currentBrewingMethod.params.stages);
  }, [currentBrewingMethod]);

  // 修改useLayoutEffect使用processExpansion
  useLayoutEffect(() => {
    if (currentBrewingMethod?.params?.stages) {
      const newExpandedStages = processExpansion();
      expandedStagesRef.current = newExpandedStages;

      // 通知扩展阶段变化
      if (onExpandedStagesChange) {
        onExpandedStagesChange(newExpandedStages);
      }

      // 重置当前阶段索引
      setCurrentExpandedStageIndex(-1);
      
      // 标记进度条准备就绪
      setIsProgressBarReady(true);
    } else {
      setIsProgressBarReady(false);
    }
  }, [processExpansion, onExpandedStagesChange, currentBrewingMethod]);

  // 修改获取当前阶段和阶段进度的函数
  const getCurrentStageAndUpdateIndex = useCallback(() => {
    if (!currentBrewingMethod?.params?.stages?.length) return -1;

    const expandedStages = expandedStagesRef.current;
    if (expandedStages.length === 0) return -1;

    // 使用StageProcessor的getCurrentStageIndex函数
    const stageIndex = getCurrentStageIndex(currentTime, expandedStages);

    // 更新当前扩展阶段索引
    if (stageIndex !== currentExpandedStageIndex) {
      setCurrentExpandedStageIndex(stageIndex);
    }

    return stageIndex;
  }, [currentTime, currentBrewingMethod, currentExpandedStageIndex]);

  // 使用StageProcessor的getStageProgress函数
  const calculateStageProgress = useCallback(
    (stageIndex: number) => {
      return getStageProgress(stageIndex, currentTime, expandedStagesRef.current);
    },
    [currentTime]
  );

  // 使用StageProcessor的calculateCurrentWater函数
  const calculateCurrentWaterAmount = useCallback(() => {
    if (!currentBrewingMethod || currentTime === 0) return 0;
    const currentStageIndex = getCurrentStageAndUpdateIndex();
    return calculateCurrentWater(currentTime, currentStageIndex, expandedStagesRef.current);
  }, [currentTime, currentBrewingMethod, getCurrentStageAndUpdateIndex]);

  useEffect(() => {
    methodStagesRef.current = currentBrewingMethod?.params.stages || [];
  }, [currentBrewingMethod]);

  const clearTimerAndStates = useCallback(() => {
    // 清除主计时器
    if (timerId) {
      clearInterval(timerId);
      setTimerId(null);
    }
    
    // 同时清除倒计时计时器
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, [timerId]);

  useEffect(() => {
    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [timerId]);

  // 完成冲煮，显示笔记表单
  const handleComplete = useCallback(() => {
    // 获取当前总时间
    const totalBrewingTime = currentTime;

    // 触发触感反馈
    setTimeout(() => {
      triggerHaptic("success");
    }, 20);

    // 播放完成音效
    playSoundEffect("correct");

    // 停止计时器
    clearTimerAndStates();

    // 设置冲煮完成状态
    setIsCompleted(true);
    setShowComplete(true);

    // 发送冲煮完成事件
    window.dispatchEvent(new Event("brewing:complete"));

    if (currentBrewingMethod) {
      // 构造基本笔记表单数据，简化参数，避免状态不必要的传递
      const initialData: Partial<BrewingNoteData> = {
        equipment: selectedEquipment || "",
        method: currentBrewingMethod.name,
        totalTime: totalBrewingTime,
        params: {
          coffee: currentBrewingMethod.params.coffee || "",
          water: currentBrewingMethod.params.water || "",
          ratio: currentBrewingMethod.params.ratio || "",
          grindSize: currentBrewingMethod.params.grindSize || "",
          temp: currentBrewingMethod.params.temp || "",
        },
        coffeeBeanInfo: {
          name: "",
          roastLevel: "中度烘焙",
          roastDate: "",
        },
        rating: 3,
        taste: {
          acidity: 3,
          sweetness: 3,
          bitterness: 3,
          body: 3,
        },
        coffeeBean: null,
        // 添加标记，确保此数据用于冲煮完成后的笔记表单
        isFromBrewingComplete: true,
        modalType: "brewing-note",
      };

      // 设置本地存储状态，确保应用知道当前处于冲煮完成记录阶段
      localStorage.setItem("brewingNoteInProgress", "true");
      // 清除可能导致状态混淆的标志
      localStorage.setItem("wasInNoteForm", "false");

      // 使用外部传入的回调函数显示记录表单
      if (onShowNoteForm) {
        onShowNoteForm(initialData);
      }
    }
  }, [
    clearTimerAndStates,
    playSoundEffect,
    currentTime,
    triggerHaptic,
    currentBrewingMethod,
    selectedEquipment,
    onShowNoteForm,
  ]);

  // 处理主计时器的启动
  const startMainTimer = useCallback(() => {
    if (currentBrewingMethod) {
      const timerCallbacks: TimerCallbacks = {
        onTick: (updater) => {
          setCurrentTime(updater);
        },
        onComplete: () => {
          setTimeout(() => {
            handleComplete();
          }, 0);
        },
        onHaptic: (type) => {
          if (isHapticsSupported && settings.hapticFeedback) {
            triggerHaptic(type as keyof typeof hapticsUtils);
          }
        }
      };

      const timerId = startTimerController(
        expandedStagesRef.current,
        audioState.current,
        settings.notificationSound,
        settings.hapticFeedback && isHapticsSupported,
        timerCallbacks
      );
      
      setTimerId(timerId);
    }
  }, [
    currentBrewingMethod,
    handleComplete,
    triggerHaptic,
    isHapticsSupported,
    settings.notificationSound,
    settings.hapticFeedback
  ]);

  // 添加startCountdown函数
  const startCountdown = useCallback((seconds: number) => {
    // 播放开始音效
    playSoundEffect("start");
    // 触发触感反馈
    triggerHaptic("medium");
    
    // 首先清除可能存在的倒计时计时器
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    
    // 设置倒计时时间
    setCountdownTime(seconds);
    
    // 创建倒计时计时器
    const countdownId = setInterval(() => {
      setCountdownTime((prev) => {
        if (prev === null) return null;
        
        // 从3倒数到1的每一秒都触发声音和震动
        if (prev > 1 && prev <= 3) {
          playSoundEffect("start");
          triggerHaptic("medium");
        }
        
        if (prev <= 1) {
          // 倒计时结束时清除
          clearInterval(countdownId);
          countdownTimerRef.current = null;
          
          // 倒计时结束
          setTimeout(() => {
            setCountdownTime(null);
            playSoundEffect("ding");
            triggerHaptic("vibrateMultiple");
            // 确保清理所有旧的计时器，然后再开始新的
            clearTimerAndStates();
            startMainTimer();
          }, 0);
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // 将ID保存在ref中以便后续可能的清除
    countdownTimerRef.current = countdownId;
    
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [playSoundEffect, triggerHaptic, startMainTimer, clearTimerAndStates]);

  // 添加倒计时ref
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 修改倒计时相关的 useEffect，使用新的倒计时控制器
  useEffect(() => {
    if (countdownTime !== null && isRunning) {
      // 确保在倒计时时清除之前的主计时器
      if (timerId) {
        clearInterval(timerId);
        setTimerId(null);
      }

      // 只有当倒计时状态发生变化时才发送事件
      if (prevCountdownTimeRef.current !== countdownTime) {
        // 通过事件向外广播倒计时状态变化
        window.dispatchEvent(
          new CustomEvent("brewing:countdownChange", {
            detail: { remainingTime: countdownTime },
          })
        );

        // 更新上一次的倒计时状态
        prevCountdownTimeRef.current = countdownTime;
      }
    }
  }, [countdownTime, isRunning, timerId]);

  // 单独添加一个 effect 用于回调通知倒计时变化
  useEffect(() => {
    // 只在必要时通知父组件
    if (onCountdownChange && prevCountdownTimeRef.current !== countdownTime) {
      onCountdownChange(countdownTime);
      // 更新上一次的倒计时状态
      prevCountdownTimeRef.current = countdownTime;
    }
  }, [countdownTime, onCountdownChange]);

  // 修改保存笔记函数，添加保存成功反馈
  const handleSaveNote = useCallback(async (note: BrewingNoteData) => {
    try {
        // 从Storage获取现有笔记
        const existingNotesStr = await Storage.get("brewingNotes");
        const existingNotes = existingNotesStr
            ? JSON.parse(existingNotesStr)
            : [];

        // 构建新笔记对象
        const newNote = {
            ...note,
            id: note.id || Date.now().toString(),
            timestamp: note.timestamp || Date.now(),
        };

        // 添加到列表开头（最新的在前面）
        const updatedNotes = [newNote, ...existingNotes];
        await Storage.set("brewingNotes", JSON.stringify(updatedNotes));

        // 设置笔记已保存标记
        localStorage.setItem("brewingNoteInProgress", "false");

        // 关闭笔记表单
        if (onShowNoteForm) {
            // 传递空对象而不是null，避免类型错误
            onShowNoteForm({});
        }
    } catch {
        alert("保存失败，请重试");
    }
  }, [onShowNoteForm]);

  useEffect(() => {
    if (
      currentTime > 0 &&
      expandedStagesRef.current.length > 0 &&
      currentTime >=
        expandedStagesRef.current[expandedStagesRef.current.length - 1]
          ?.endTime &&
      !isCompleted
    ) {
      // 使用setTimeout将handleComplete的调用推迟到下一个事件循环

      setTimeout(() => {
        handleComplete();
      }, 0);
    }
  }, [currentTime, handleComplete, isCompleted]);

  const resetTimer = useCallback(() => {
    triggerHaptic("warning");
    clearTimerAndStates();
    setIsRunning(false);
    setCurrentTime(0);
    setShowComplete(false);
    setCurrentWaterAmount(0);

    // 重置倒计时
    setCountdownTime(null);
    // 重置上一次的倒计时状态引用
    prevCountdownTimeRef.current = null;

    // 手动触发一次事件，确保其他组件知道倒计时已结束
    window.dispatchEvent(
      new CustomEvent("brewing:countdownChange", {
        detail: { remainingTime: null },
      })
    );

    setHasStartedOnce(false);
    setIsCompleted(false);

    // 清除笔记进度标记和保存的表单数据
    localStorage.setItem("brewingNoteInProgress", "false");

    // 触发一个事件通知其他组件重置
    const event = new CustomEvent("brewing:reset");
    window.dispatchEvent(event);
  }, [clearTimerAndStates, triggerHaptic]);

  const pauseTimer = useCallback(() => {
    triggerHaptic("light");
    clearTimerAndStates();
    setIsRunning(false);
  }, [clearTimerAndStates, triggerHaptic]);

  // 修改启动计时器的函数
  const startTimer = useCallback(() => {
    if (!isRunning && currentBrewingMethod) {
      // 如果冲煮已完成，先重置所有状态
      if (showComplete || isCompleted || isCoffeeBrewed) {
        // 确保触发resetTimer函数，这会同时触发brewing:reset事件
        resetTimer();

        // 确保通知所有组件冲煮已经重置
        window.dispatchEvent(new CustomEvent("brewing:reset"));

        // 延迟启动计时器，确保状态已完全重置
        setTimeout(() => {
          setIsRunning(true);
          // 启动倒计时
          startCountdown(3);
          setHasStartedOnce(true);
        }, 100);

        return;
      }

      // 常规启动逻辑
      setIsRunning(true);

      if (!hasStartedOnce || currentTime === 0) {
        // 启动倒计时
        startCountdown(3);
        setHasStartedOnce(true);
      } else {
        // 确保在开始主计时器前清理任何现有的计时器
        clearTimerAndStates();
        startMainTimer();
      }
    }
  }, [
    isRunning,
    currentBrewingMethod,
    hasStartedOnce,
    startMainTimer,
    clearTimerAndStates,
    currentTime,
    showComplete,
    isCompleted,
    isCoffeeBrewed,
    resetTimer,
    startCountdown,
  ]);

  useEffect(() => {
    if (isRunning) {
      const waterAmount = calculateCurrentWaterAmount();
      setCurrentWaterAmount(Math.round(waterAmount));
    }
  }, [currentTime, isRunning, calculateCurrentWaterAmount]);

  useEffect(() => {
    onStatusChange?.({ isRunning });
  }, [isRunning, onStatusChange]);

  // 修改向外通知阶段变化的函数
  useEffect(() => {
    const currentStage = getCurrentStageAndUpdateIndex();
    const progress = calculateStageProgress(currentStage);

    if (currentStage >= 0 && expandedStagesRef.current.length > 0) {
      const currentExpandedStage = expandedStagesRef.current[currentStage];

      onStageChange?.({
        currentStage: currentStage,
        progress: progress,
        isWaiting: currentExpandedStage.type === "wait",
      });
    }
  }, [currentTime, getCurrentStageAndUpdateIndex, calculateStageProgress, onStageChange]);

  // 监听brewing:paramsUpdated事件，更新笔记表单数据
  useEffect(() => {
    const handleParamsUpdated = (
      e: CustomEvent<{
        params: Partial<{
          coffee: string;
          water: string;
          ratio: string;
          grindSize: string;
          temp: string;
        }>;
        coffeeBean?: {
          name: string;
          roastLevel: string;
          roastDate: string;
        } | null;
      }>
    ) => {
      // 只有在有当前方法时进行更新
      if (currentBrewingMethod && isCompleted) {
        // 忽略更新noteFormInitialData的代码，因为我们已移除此状态
      }
    };

    window.addEventListener(
      "brewing:paramsUpdated",
      handleParamsUpdated as EventListener
    );

    return () => {
      window.removeEventListener(
        "brewing:paramsUpdated",
        handleParamsUpdated as EventListener
      );
    };
  }, [currentBrewingMethod, isCompleted]);

  // 触感反馈在阶段变化时
  useEffect(() => {
    const currentStage = getCurrentStageAndUpdateIndex();
    if (
      currentStage !== lastStageRef.current &&
      isRunning &&
      lastStageRef.current !== -1
    ) {
      triggerHaptic("medium");
    }
    lastStageRef.current = currentStage;
  }, [currentTime, getCurrentStageAndUpdateIndex, isRunning, triggerHaptic]);

  // 添加监听methodSelected事件，确保在导入后正确更新参数
  useEffect(() => {
    const handleMethodSelected = (
      e: CustomEvent<{
        methodName?: string;
        equipment?: string;
        coffee?: string;
        water?: string;
        ratio?: string;
        grindSize?: string;
        temp?: string;
        stages?: Stage[];
      }>
    ) => {
      // 记录接收到事件

      // 如果计时器正在运行，不进行更新
      if (isRunning) {
        return;
      }

      // 重置计时器状态
      resetTimer();

      // 更新扩展阶段引用
      if (e.detail.stages) {
        methodStagesRef.current = e.detail.stages;
        expandedStagesRef.current = processExpansion();
      }
    };

    // 添加自定义事件监听器
    window.addEventListener(
      "methodSelected",
      handleMethodSelected as EventListener
    );

    return () => {
      window.removeEventListener(
        "methodSelected",
        handleMethodSelected as EventListener
      );
    };
  }, [isRunning, resetTimer, processExpansion]);

  // 在组件挂载后，同步外部冲煮状态到内部状态
  useEffect(() => {
    if (isCoffeeBrewed !== undefined) {
      setShowComplete(isCoffeeBrewed);
      setIsCompleted(isCoffeeBrewed);
    }
  }, [isCoffeeBrewed]);

  // 监听当前阶段变化并发送事件
  useEffect(() => {
    if (
      currentExpandedStageIndex >= 0 &&
      expandedStagesRef.current.length > 0
    ) {
      const currentStage = expandedStagesRef.current[currentExpandedStageIndex];
      const stageProgress =
        (currentTime - currentStage.startTime) /
        (currentStage.endTime - currentStage.startTime);
      const isWaiting = currentStage.type === "wait";

      // 发送阶段变化事件
      const stageEvent = new CustomEvent("brewing:stageChange", {
        detail: {
          currentStage: currentExpandedStageIndex,
          stage: currentExpandedStageIndex, // 同时包含stage和currentStage，确保兼容性
          progress: stageProgress,
          isWaiting: isWaiting,
        },
      });
      window.dispatchEvent(stageEvent);

      // 调用回调
      onStageChange?.({
        currentStage: currentExpandedStageIndex,
        progress: stageProgress,
        isWaiting: isWaiting,
      });
    }
  }, [currentExpandedStageIndex, currentTime, onStageChange]);

  // 修改跳过处理函数
  const handleSkip = useCallback(() => {
    if (!currentBrewingMethod || !expandedStagesRef.current.length) return;

    // 获取最后一个阶段的结束时间
    const lastStage =
      expandedStagesRef.current[expandedStagesRef.current.length - 1];
    if (!lastStage) return;

    // 先暂停计时器
    clearTimerAndStates();
    setIsRunning(false);

    // 设置当前时间为最后阶段的结束时间
    setCurrentTime(lastStage.endTime);

    // 添加短暂延迟，模拟正常完成过程
    setTimeout(() => {
      // 触发完成处理
      handleComplete();

      // 确保状态完全同步
      setShowComplete(true);
      setIsCompleted(true);

      // 触发完成事件
      window.dispatchEvent(
        new CustomEvent("brewing:complete", {
          detail: { skipped: true, totalTime: lastStage.endTime },
        })
      );
    }, 300); // 添加300ms延迟，模拟正常完成过程
  }, [currentBrewingMethod, handleComplete, clearTimerAndStates]);

  // 监听阶段变化以显示跳过按钮
  useEffect(() => {
    if (!currentBrewingMethod || !expandedStagesRef.current.length) return;

    const expandedStages = expandedStagesRef.current;
    const lastStageIndex = expandedStages.length - 1;
    const currentStage = getCurrentStageAndUpdateIndex();

    // 只在最后一个阶段且是等待阶段时显示跳过按钮
    const isLastStage = currentStage === lastStageIndex;
    const isWaitingStage =
      isLastStage && expandedStages[lastStageIndex]?.type === "wait";

    setShowSkipButton(isLastStage && isWaitingStage && isRunning);
  }, [currentTime, getCurrentStageAndUpdateIndex, currentBrewingMethod, isRunning]);

  useEffect(() => {
    // 使用提取出的工具函数处理屏幕常亮
    handleScreenWake(isRunning, hasStartedOnce);

    return () => {
      // 使用提取出的清理函数
      cleanupScreenWake();
    };
  }, [isRunning, hasStartedOnce]);

  // 添加监听brewing:methodSelected事件
  useEffect(() => {
    const handleBrewingMethodSelected = (
      e: CustomEvent<{
        method: any; 
        fromNoteForm: boolean;
      }>
    ) => {
      // 如果是从笔记表单返回后选择的方法，需要特殊处理
      if (e.detail.fromNoteForm) {
        // 确保所有状态被重置
        resetTimer();
        setIsCompleted(false);
        setShowComplete(false);
        setIsRunning(false);
        
        // 重新处理扩展阶段
        expandedStagesRef.current = processExpansion();
        
        // 通知其他组件计时器已准备就绪
        window.dispatchEvent(new CustomEvent('brewing:timerReady'));
      }
    };

    // 添加自定义事件监听器
    window.addEventListener(
      "brewing:methodSelected",
      handleBrewingMethodSelected as EventListener
    );

    return () => {
      window.removeEventListener(
        "brewing:methodSelected",
        handleBrewingMethodSelected as EventListener
      );
    };
  }, [resetTimer, processExpansion]);

  if (!currentBrewingMethod) return null;

  // 获取当前扩展阶段
  const currentStageIndex =
    currentExpandedStageIndex >= 0
      ? currentExpandedStageIndex
      : expandedStagesRef.current.length > 0
      ? 0
      : -1;

  const currentStage =
    currentStageIndex >= 0 && expandedStagesRef.current.length > 0
      ? expandedStagesRef.current[currentStageIndex]
      : null;

  // 获取下一个扩展阶段
  const nextStageIndex =
    currentStageIndex >= 0 &&
    currentStageIndex < expandedStagesRef.current.length - 1
      ? currentStageIndex + 1
      : -1;

  const nextStage =
    nextStageIndex >= 0 ? expandedStagesRef.current[nextStageIndex] : null;

  // 计算当前阶段的流速（无论是否正在运行）
  const currentFlowRateValue = currentStage?.type === "pour" 
    ? calculateTargetFlowRate(currentStage, expandedStagesRef.current) 
    : 0;
    
  // 直接使用计算好的流速值
  const displayFlowRate = currentFlowRateValue;

  return (
    <>
      <div
        className="px-6 sticky bottom-0 bg-neutral-50 pt-6 dark:bg-neutral-900 pb-safe-bottom relative"
      >
        {/* 添加设置点和边框 */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-center">
          <div className="relative w-full border-t border-neutral-200 dark:border-neutral-800">
            <div className="absolute top-1/2 right-6 -translate-y-1/2 flex items-center">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="h-4 px-2 -mr-2 bg-neutral-50 dark:bg-neutral-900 flex items-center gap-1"
              >
                <div className="w-[3px] h-[3px] rounded-full bg-neutral-300 dark:bg-neutral-700 hover:bg-neutral-400 dark:hover:bg-neutral-600 transition-colors" />
                <div className="w-[3px] h-[3px] rounded-full bg-neutral-300 dark:bg-neutral-700 hover:bg-neutral-400 dark:hover:bg-neutral-600 transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* 设置面板 */}
        <AnimatePresence>
          {showSettings && (
            <BrewingTimerSettings
              show={showSettings}
              onClose={() => setShowSettings(false)}
              layoutSettings={localLayoutSettings}
              showFlowRate={localShowFlowRate}
              onLayoutChange={handleLayoutChange}
              onFlowRateSettingChange={handleFlowRateSettingChange}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSkipButton && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={handleSkip}
              className="absolute right-6 -top-12 flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 transform-gpu"
              style={{
                willChange: "transform, opacity",
                transform: "translateZ(0)",
                contain: "layout",
                backfaceVisibility: "hidden",
              }}
              whileTap={{ scale: 0.95 }}
            >
              <span>跳过当前阶段</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z"
                />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {(isRunning || localLayoutSettings.alwaysShowTimerInfo) && isProgressBarReady && (
            <motion.div
              key="brewing-info"
              className="overflow-hidden will-change-auto"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                duration: 0.26,
                ease: [0.4, 0, 0.2, 1],
                opacity: { duration: 0.1 },
              }}
              style={{
                contain: "content",
                backfaceVisibility: "hidden",
                WebkitFontSmoothing: "subpixel-antialiased",
              }}
            >
              <div className="space-y-3 transform-gpu">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-3"
                  style={{
                    willChange: "transform, opacity",
                    backfaceVisibility: "hidden",
                  }}
                >
                  <div
                    className={`flex items-baseline border-l-2 border-neutral-800 pl-3 dark:border-neutral-100 ${
                      localLayoutSettings.stageInfoReversed
                        ? "flex-row-reverse"
                        : "flex-row"
                    } justify-between`}
                  >
                    <div
                      className={`${
                        localLayoutSettings.stageInfoReversed
                          ? "text-right"
                          : "text-left"
                      }`}
                    >
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        当前阶段
                      </div>
                      <motion.div
                        key={currentStageIndex}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.26 }}
                        className="mt-1 text-sm font-medium tracking-wide"
                        style={{
                          willChange: "transform, opacity",
                          backfaceVisibility: "hidden",
                        }}
                      >
                        {currentStage
                          ? currentStage.type === "pour"
                            ? currentStage.label
                            : `等待`
                          : "完成冲煮"}
                      </motion.div>
                    </div>
                    <div
                      className={`flex items-baseline flex-row ${
                        localLayoutSettings.stageInfoReversed
                          ? "text-left"
                          : "text-right"
                      }`}
                    >
                      <div
                        className={
                          localLayoutSettings.stageInfoReversed ? "mr-4" : "mr-0"
                        }
                      >
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          目标时间
                        </div>
                        <motion.div
                          key={`time-${currentStageIndex}`}
                          initial={{ opacity: 0.8 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.26 }}
                          className="mt-1 text-sm font-medium tracking-wide"
                        >
                          {currentStage
                            ? formatTime(currentStage.endTime, true)
                            : "-"}
                        </motion.div>
                      </div>
                      <div className={`${localShowFlowRate ? 'min-w-20' : 'min-w-24'}`}>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          目标水量
                        </div>
                        <motion.div
                          key={`water-${currentStageIndex}`}
                          initial={{ opacity: 0.8 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.26 }}
                          className="mt-1 flex flex-col text-sm font-medium tracking-wide"
                        >
                          {currentStage?.water ? (
                            <div
                              className={`flex items-baseline ${
                                localLayoutSettings.stageInfoReversed
                                  ? "justify-start"
                                  : "justify-end"
                              }`}
                            >
                              <span>{currentWaterAmount}</span>
                              <span className="mx-0.5 text-neutral-300 dark:text-neutral-600">
                                /
                              </span>
                              <span>{currentStage.water}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </motion.div>
                      </div>
                      {localShowFlowRate && (
                        <div className="min-w-14">
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            流速
                          </div>
                          <motion.div
                            key={`flow-rate-${currentStageIndex}`}
                            initial={{ opacity: 0.8 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.26 }}
                            className="mt-1 text-sm font-medium tracking-wide"
                          >
                            {currentStage?.type === "pour" ? (
                              <span>{displayFlowRate.toFixed(1)}</span>
                            ) : (
                              "-"
                            )}
                          </motion.div>
                        </div>
                      )}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {nextStage && (
                      <motion.div
                        key={`next-${nextStageIndex}`}
                        initial={{ opacity: 0, height: 0, y: -20 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -20 }}
                        transition={{ duration: 0.26 }}
                        className={`flex items-baseline border-l m border-neutral-300 pl-3 dark:border-neutral-700 ${
                          localLayoutSettings.stageInfoReversed
                            ? "flex-row-reverse"
                            : "flex-row"
                        } justify-between transform-gpu`}
                        style={{
                          willChange: "transform, opacity, height",
                          backfaceVisibility: "hidden",
                        }}
                      >
                        <div
                          className={`${
                            localLayoutSettings.stageInfoReversed
                              ? "text-right"
                              : "text-left"
                          }`}
                        >
                          <div
                            className={`flex items-center ${
                              localLayoutSettings.stageInfoReversed
                                ? "justify-end"
                                : "justify-start"
                            } gap-2 text-xs text-neutral-500 dark:text-neutral-400`}
                          >
                            <span>下一步</span>
                          </div>
                          <motion.div
                            initial={{
                              opacity: 0,
                              x: localLayoutSettings.stageInfoReversed ? 10 : -10,
                            }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.26, delay: 0.1 }}
                            className="mt-1"
                          >
                            <span className="text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                              {nextStage.type === "pour"
                                ? nextStage.label
                                : `等待`}
                            </span>
                          </motion.div>
                        </div>
                        <motion.div
                          initial={{
                            opacity: 0,
                            x: localLayoutSettings.stageInfoReversed ? -10 : 10,
                          }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.26, delay: 0.2 }}
                          className={`flex items-baseline flex-row ${
                            localLayoutSettings.stageInfoReversed
                              ? "text-left"
                              : "text-right "
                          }`}
                        >
                          <div
                            className={
                              localLayoutSettings.stageInfoReversed ? "mr-4" : "mr-0"
                            }
                          >
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">
                              目标时间
                            </div>
                            <div className="mt-1 text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                              {formatTime(nextStage.endTime, true)}
                            </div>
                          </div>
                          <div className={`${localShowFlowRate ? 'min-w-20' : 'min-w-24'}`}>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">
                              目标水量
                            </div>
                            <div
                              className={`mt-1 text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400 ${
                                localLayoutSettings.stageInfoReversed
                                  ? "text-left"
                                  : "text-right"
                              }`}
                            >
                              {nextStage.water}
                            </div>
                          </div>
                          {localShowFlowRate && (
                            <div className="min-w-14">
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                流速
                              </div>
                              <div
                                className={`mt-1 text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400 ${
                                  localLayoutSettings.stageInfoReversed
                                    ? "text-left"
                                    : "text-right"
                                }`}
                              >
                                {nextStage.type === "pour" ? (
                                  <>
                                    <span>{calculateTargetFlowRate(nextStage, expandedStagesRef.current).toFixed(1)}</span>
                                  </>
                                ) : (
                                  "-"
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 进度条 */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                    className="relative pb-3"
                  >
                    {expandedStagesRef.current.map((stage) => {
                      const totalTime =
                        expandedStagesRef.current[
                          expandedStagesRef.current.length - 1
                        ].endTime;
                      const percentage = (stage.endTime / totalTime) * 100;
                      return localLayoutSettings?.showStageDivider ? (
                        <div
                          key={stage.endTime}
                          className="absolute top-0 w-[2px] bg-neutral-50 dark:bg-neutral-900"
                          style={{
                            left: `${percentage}%`,
                            height: `${localLayoutSettings.progressBarHeight || 4}px`,
                            opacity: 0.8,
                            transform: "translateZ(0)",
                          }}
                        />
                      ) : null;
                    })}

                    <div
                      className="w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800"
                      style={{
                        height: `${localLayoutSettings.progressBarHeight || 4}px`,
                        contain: "paint layout",
                        position: "relative",
                      }}
                    >
                      {/* 阶段分隔线 */}
                      {expandedStagesRef.current.map((stage, index) => {
                        // 跳过第一个阶段的开始线（最左侧）
                        if (index === 0) return null;
                        
                        const totalTime =
                          expandedStagesRef.current[
                            expandedStagesRef.current.length - 1
                          ].endTime;
                        const percentage = (stage.startTime / totalTime) * 100;
                        
                        return (
                          <div
                            key={`divider-${stage.startTime}`}
                            className="absolute top-0 bottom-0 z-10 w-[1.5px] bg-neutral-100 dark:bg-neutral-900"
                            style={{
                              left: `${percentage}%`,
                              height: `${localLayoutSettings.progressBarHeight || 4}px`,
                            }}
                          />
                        );
                      })}
                      
                      {/* 等待阶段的斜纹背景 */}
                      {expandedStagesRef.current.map((stage) => {
                        const totalTime =
                          expandedStagesRef.current[
                            expandedStagesRef.current.length - 1
                          ].endTime;
                        const startPercentage =
                          (stage.startTime / totalTime) * 100;
                        const width =
                          ((stage.endTime - stage.startTime) / totalTime) * 100;

                        return stage.type === "wait" ? (
                          <div
                            key={`waiting-${stage.endTime}`}
                            className="absolute"
                            style={{
                              left: `${startPercentage}%`,
                              width: `${width}%`,
                              height: `${
                                localLayoutSettings.progressBarHeight || 4
                              }px`,
                              background: `repeating-linear-gradient(
                                45deg,
                                transparent,
                                transparent 4px,
                                rgba(0, 0, 0, 0.1) 4px,
                                rgba(0, 0, 0, 0.1) 8px
                              )`,
                              transform: "translateZ(0)",
                            }}
                          />
                        ) : null;
                      })}
                      
                      {/* 进度指示器 */}
                      <motion.div
                        className="h-full bg-neutral-800 dark:bg-neutral-100 transform-gpu"
                        initial={{ width: 0 }}
                        animate={{
                          width: currentTime > 0 && expandedStagesRef.current.length > 0
                            ? `${(currentTime / (expandedStagesRef.current[expandedStagesRef.current.length - 1]?.endTime || 1)) * 100}%`
                            : "0%"
                        }}
                        transition={{
                          duration: 0.26,
                          ease: [0.4, 0, 0.2, 1],
                        }}
                        style={{
                          willChange: "width",
                          transformOrigin: "left center",
                          contain: "layout",
                          backfaceVisibility: "hidden",
                          position: "relative",
                          zIndex: 5,
                        }}
                      />
                    </div>

                    <div className="relative mt-1 h-4 w-full">
                      {/* 当前阶段时间标记 */}
                      {currentStage && (
                        <div
                          key={`current-${currentStage.endTime}`}
                          className="absolute top-0 font-medium text-[9px] text-neutral-600 dark:text-neutral-300"
                          style={{
                            left: `${(currentStage.endTime / expandedStagesRef.current[expandedStagesRef.current.length - 1].endTime) * 100}%`,
                            transform: "translateX(-100%)",
                          }}
                        >
                          {formatTime(currentStage.endTime, true)}
                        </div>
                      )}
                      
                      {/* 最后阶段时间标记 */}
                      {expandedStagesRef.current.length > 0 && (
                        <div
                          key="final-time"
                          className="absolute top-0 right-0 font-medium text-[9px] text-neutral-600 dark:text-neutral-300"
                        >
                          {formatTime(expandedStagesRef.current[expandedStagesRef.current.length - 1].endTime, true)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={`flex items-center ${
            localLayoutSettings.controlsReversed ? "flex-row-reverse" : "flex-row"
          } justify-between`}
        >
          <div
            className={`grid ${
              localLayoutSettings.controlsReversed
                ? `grid-cols-[auto_auto_auto] ${localShowFlowRate ? 'gap-4' : 'gap-8'}`
                : `grid-cols-[auto_auto_auto] ${localShowFlowRate ? 'gap-4' : 'gap-8'}`
            }`}
          >
            <div
              className={`flex flex-col ${
                localLayoutSettings.controlsReversed ? "items-end" : "items-start"
              }`}
            >
              <span className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                时间
              </span>
              <div className="relative text-2xl font-light tracking-widest text-neutral-800 sm:text-3xl dark:text-neutral-100">
                <AnimatePresence mode="wait">
                  {countdownTime !== null ? (
                    <motion.div
                      key="countdown"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.26 }}
                      className={`timer-font min-w-[4ch] ${
                        localLayoutSettings.controlsReversed
                          ? "text-right"
                          : "text-left"
                      } transform-gpu`}
                      style={{
                        willChange: "transform, opacity",
                        transform: "translateZ(0)",
                        contain: "content",
                        backfaceVisibility: "hidden",
                      }}
                    >
                      {`0:${countdownTime.toString().padStart(2, "0")}`}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="timer"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.26 }}
                      className={`timer-font min-w-[4ch] ${
                        localLayoutSettings.controlsReversed
                          ? "text-right"
                          : "text-left"
                      } transform-gpu`}
                      style={{
                        willChange: "transform, opacity",
                        transform: "translateZ(0)",
                        contain: "content",
                        backfaceVisibility: "hidden",
                      }}
                    >
                      {formatTime(currentTime)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div
              className={`flex flex-col ${
                localLayoutSettings.controlsReversed ? "items-end" : "items-start"
              }`}
            >
              <span className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                水量
              </span>
              <div className="text-2xl font-light tracking-widest text-neutral-800 sm:text-3xl dark:text-neutral-100">
                <motion.div
                  className={`timer-font min-w-[4ch] ${
                    localLayoutSettings.controlsReversed ? "text-right" : "text-left"
                  } transform-gpu`}
                  animate={{
                    opacity: [null, 1],
                    scale: currentWaterAmount > 0 ? [1.02, 1] : 1,
                  }}
                  transition={{
                    duration: 0.15,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  style={{
                    willChange: "transform, opacity",
                    transform: "translateZ(0)",
                    contain: "content",
                    backfaceVisibility: "hidden",
                  }}
                >
                  <span>{currentWaterAmount}</span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400 ml-1">
                    g
                  </span>
                </motion.div>
              </div>
            </div>

            {localShowFlowRate && (
              <div
                className={`flex flex-col ${
                  localLayoutSettings.controlsReversed ? "items-end" : "items-start"
                }`}
              >
                <span className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  流速
                </span>
                <div className="text-2xl font-light tracking-widest text-neutral-800 sm:text-3xl dark:text-neutral-100">
                  <motion.div
                    className={`timer-font min-w-[3ch] ${
                      localLayoutSettings.controlsReversed ? "text-right" : "text-left"
                    } transform-gpu`}
                    animate={{
                      opacity: [null, 1],
                      scale: displayFlowRate > 0 ? [1.02, 1] : 1,
                    }}
                    transition={{
                      duration: 0.15,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                    style={{
                      willChange: "transform, opacity",
                      transform: "translateZ(0)",
                      contain: "content",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    <span>{displayFlowRate.toFixed(1)}</span>
                  </motion.div>
                </div>
              </div>
            )}
          </div>

          <div
            className={`flex items-center ${
              localLayoutSettings.controlsReversed
                ? "flex-row-reverse space-x-4 space-x-reverse"
                : "flex-row space-x-4"
            }`}
          >
            <motion.button
              onClick={isRunning ? pauseTimer : startTimer}
              className={`${localShowFlowRate ? 'w-12 h-12' : 'w-14 h-14'} flex items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 transform-gpu`}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
              style={{
                willChange: "transform",
                transform: "translateZ(0)",
                contain: "layout",
                backfaceVisibility: "hidden",
              }}
            >
              {isRunning ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className={`${localShowFlowRate ? 'w-5 h-5' : 'w-6 h-6'}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 5.25v13.5m-7.5-13.5v13.5"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className={`${localShowFlowRate ? 'w-5 h-5' : 'w-6 h-6'}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                  />
                </svg>
              )}
            </motion.button>
            <motion.button
              onClick={resetTimer}
              className={`${localShowFlowRate ? 'w-12 h-12' : 'w-14 h-14'} flex items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 transform-gpu`}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
              style={{
                willChange: "transform",
                transform: "translateZ(0)",
                contain: "layout",
                backfaceVisibility: "hidden",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={`${localShowFlowRate ? 'w-5 h-5' : 'w-6 h-6'}`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>
    </>
  );
};

export default BrewingTimer;
