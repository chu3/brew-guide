"use client";

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BrewingNoteForm from "@/components/BrewingNoteForm";
import type { BrewingNoteData, CoffeeBean } from "@/app/types";
import type { Method, Stage } from "@/lib/config";
import type { SettingsOptions } from "@/components/Settings";
import { KeepAwake } from "@capacitor-community/keep-awake";
import hapticsUtils from "@/lib/haptics";
import { Storage } from "@/lib/storage";
import { equipmentList } from "@/lib/config";

// 添加布局设置接口
export interface LayoutSettings {
  stageInfoReversed?: boolean; // 是否反转阶段信息布局
  progressBarHeight?: number; // 进度条高度（像素）
  controlsReversed?: boolean; // 是否反转底部控制区布局
  alwaysShowTimerInfo?: boolean; // 是否始终显示计时器信息区域
  showStageDivider?: boolean; // 是否显示阶段分隔线
}

// 添加是否支持KeepAwake的检查
const isKeepAwakeSupported = () => {
  try {
    return typeof KeepAwake !== "undefined";
  } catch {
    return false;
  }
};

// Helper function to format time
const formatTime = (seconds: number, compact: boolean = false) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (compact) {
    return mins > 0
      ? `${mins}'${secs.toString().padStart(2, "0")}"`
      : `${secs}"`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

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
  settings: SettingsOptions;
  selectedEquipment: string | null;
  isCoffeeBrewed?: boolean;
  layoutSettings?: LayoutSettings; // 添加布局设置选项
}

// 定义扩展阶段类型
type ExpandedStage = {
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
};

const BrewingTimer: React.FC<BrewingTimerProps> = ({
  currentBrewingMethod,
  onTimerComplete,
  onStatusChange,
  onStageChange,
  onComplete,
  onCountdownChange,
  onExpandedStagesChange,
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

  const audioContext = useRef<AudioContext | null>(null);
  const audioBuffers = useRef<{
    start: AudioBuffer | null;
    ding: AudioBuffer | null;
    correct: AudioBuffer | null;
  }>({
    start: null,
    ding: null,
    correct: null,
  });
  const lastPlayedTime = useRef<{
    start: number;
    ding: number;
    correct: number;
  }>({
    start: 0,
    ding: 0,
    correct: 0,
  });
  const audioLoaded = useRef<boolean>(false);
  const methodStagesRef = useRef(currentBrewingMethod?.params.stages || []);
  const [showNoteForm, setShowNoteForm] = useState(false);

  // 添加一个状态来保存笔记表单的初始内容
  const [noteFormInitialData, setNoteFormInitialData] = useState<
    | (Partial<BrewingNoteData> & {
        coffeeBean?: CoffeeBean | null;
      })
    | null
  >(null);

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
    
    // 记录日志
    console.log('发送布局设置变更:', newSettings);
    
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
          console.log('流速设置已保存', showFlowRate);
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
    const initAudioSystem = () => {
      try {
        if (typeof window !== "undefined" && "AudioContext" in window) {
          audioContext.current = new AudioContext();

          const loadAudio = async () => {
            try {
              const fetchAudio = async (url: string): Promise<AudioBuffer> => {
                const response = await fetch(url, { cache: "force-cache" });
                const arrayBuffer = await response.arrayBuffer();
                if (audioContext.current) {
                  return await audioContext.current.decodeAudioData(
                    arrayBuffer
                  );
                }
                throw new Error("AudioContext not initialized");
              };

              const [startBuffer, dingBuffer, correctBuffer] =
                await Promise.all([
                  fetchAudio("/sounds/start.mp3"),
                  fetchAudio("/sounds/ding.mp3"),
                  fetchAudio("/sounds/correct.mp3"),
                ]);

              audioBuffers.current = {
                start: startBuffer,
                ding: dingBuffer,
                correct: correctBuffer,
              };

              audioLoaded.current = true;
            } catch {
              // 加载音频文件失败，静默处理
            }
          };

          loadAudio();
        } else {
          // 浏览器不支持Web Audio API，静默处理
        }
      } catch {
        // 初始化音频系统失败，静默处理
      }
    };

    const handleUserInteraction = () => {
      if (audioContext.current?.state === "suspended") {
        audioContext.current.resume();
      }
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
    };

    document.addEventListener("click", handleUserInteraction);
    document.addEventListener("touchstart", handleUserInteraction);

    initAudioSystem();

    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
      audioContext.current?.close();
    };
  }, []);

  const playSound = useCallback(
    (type: "start" | "ding" | "correct") => {
      if (!settings.notificationSound) {
        return;
      }

      if (!audioContext.current || !audioBuffers.current[type]) {
        // 音频系统未初始化或音频文件未加载，静默处理
        return;
      }

      if (audioContext.current.state === "suspended") {
        audioContext.current.resume();
      }

      const now = Date.now();

      if (now - lastPlayedTime.current[type] < 300) {
        return;
      }

      try {
        const source = audioContext.current.createBufferSource();
        source.buffer = audioBuffers.current[type];

        const gainNode = audioContext.current.createGain();
        gainNode.gain.value = 0.5;

        source.connect(gainNode);
        gainNode.connect(audioContext.current.destination);

        source.start(0);

        lastPlayedTime.current[type] = now;
      } catch {
        // 播放音效失败，静默处理
      }
    },
    [settings.notificationSound]
  );

  // 创建扩展阶段数组，将原始阶段的注水和等待部分拆分为独立阶段
  const createExpandedStages = useCallback(() => {
    if (!currentBrewingMethod?.params?.stages?.length) return [];

    const originalStages = currentBrewingMethod.params.stages;
    const expandedStages: ExpandedStage[] = [];

    originalStages.forEach((stage, index) => {
      const prevStageTime = index > 0 ? originalStages[index - 1].time : 0;
      const stagePourTime =
        stage.pourTime === 0
          ? 0
          : stage.pourTime || Math.floor((stage.time - prevStageTime) / 3);

      // 如果有注水时间，添加一个注水阶段
      if (stagePourTime > 0) {
        // 创建注水阶段
        expandedStages.push({
          type: "pour",
          label: stage.label,
          startTime: prevStageTime,
          endTime: prevStageTime + stagePourTime,
          time: stagePourTime,
          pourTime: stagePourTime,
          water: stage.water,
          detail: stage.detail,
          pourType: stage.pourType,
          valveStatus: stage.valveStatus,
          originalIndex: index,
        });

        // 只有当注水结束时间小于阶段结束时间时，才添加等待阶段
        if (prevStageTime + stagePourTime < stage.time) {
          // 创建等待阶段
          expandedStages.push({
            type: "wait",
            label: "等待",
            startTime: prevStageTime + stagePourTime,
            endTime: stage.time,
            time: stage.time - (prevStageTime + stagePourTime),
            water: stage.water, // 水量与前一阶段相同
            detail: "保持耐心，等待咖啡萃取",
            pourType: stage.pourType, // 保留注水类型以便视觉一致性
            valveStatus: stage.valveStatus,
            originalIndex: index,
          });
        }
      } else {
        // 如果没有注水时间，只添加一个等待阶段
        // 当pourTime明确设为0时，保留原始标签，否则使用默认"等待"标签
        expandedStages.push({
          type: "wait",
          label: stage.pourTime === 0 ? stage.label : "等待",
          startTime: prevStageTime,
          endTime: stage.time,
          time: stage.time - prevStageTime,
          water: stage.water,
          detail:
            stage.pourTime === 0 ? stage.detail : "保持耐心，等待咖啡萃取",
          pourType: stage.pourType,
          valveStatus: stage.valveStatus,
          originalIndex: index,
        });
      }
    });

    return expandedStages;
  }, [currentBrewingMethod]);

  // 修改扩展阶段数组更新的 useEffect
  useLayoutEffect(() => {
    if (currentBrewingMethod?.params?.stages) {
      const newExpandedStages = createExpandedStages();
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
  }, [createExpandedStages, onExpandedStagesChange, currentBrewingMethod]);

  // 获取当前阶段 - 修改为使用扩展阶段
  const getCurrentStage = useCallback(() => {
    if (!currentBrewingMethod?.params?.stages?.length) return -1;

    // 确保扩展阶段已创建
    const expandedStages = expandedStagesRef.current;
    if (expandedStages.length === 0) return -1;

    // 在扩展的阶段中查找当前阶段
    const expandedStageIndex = expandedStages.findIndex(
      (stage) => currentTime >= stage.startTime && currentTime <= stage.endTime
    );

    // 如果找不到合适的阶段，返回最后一个扩展阶段
    if (expandedStageIndex === -1 && currentTime > 0) {
      return expandedStages.length - 1;
    }

    // 更新当前扩展阶段索引
    if (expandedStageIndex !== currentExpandedStageIndex) {
      setCurrentExpandedStageIndex(expandedStageIndex);
    }

    return expandedStageIndex;
  }, [currentTime, currentBrewingMethod, currentExpandedStageIndex]);

  // 修改计算水量的函数
  const calculateCurrentWater = useCallback(() => {
    if (!currentBrewingMethod || currentTime === 0) return 0;

    const expandedStages = expandedStagesRef.current;
    if (expandedStages.length === 0) return 0;

    const currentStageIndex = getCurrentStage();

    if (currentStageIndex === -1) {
      return parseInt(expandedStages[expandedStages.length - 1].water);
    }

    const currentStage = expandedStages[currentStageIndex];
    const prevStageIndex = currentStageIndex > 0 ? currentStageIndex - 1 : -1;
    const prevStage =
      prevStageIndex >= 0 ? expandedStages[prevStageIndex] : null;

    const prevStageTime = currentStage.startTime;
    const prevStageWater =
      prevStage?.type === "pour"
        ? parseInt(prevStage.water)
        : prevStageIndex > 0
        ? parseInt(expandedStages[prevStageIndex - 1].water)
        : 0;

    if (currentStage.type === "wait") {
      // 等待阶段，水量已经达到目标
      return parseInt(currentStage.water);
    }

    const pourTime = currentStage.time;
    const timeInCurrentStage = currentTime - prevStageTime;
    const currentTargetWater = parseInt(currentStage.water);

    if (timeInCurrentStage <= pourTime) {
      const pourProgress = timeInCurrentStage / pourTime;
      return (
        prevStageWater + (currentTargetWater - prevStageWater) * pourProgress
      );
    }

    return currentTargetWater;
  }, [currentTime, currentBrewingMethod, getCurrentStage]);

  useEffect(() => {
    methodStagesRef.current = currentBrewingMethod?.params.stages || [];
  }, [currentBrewingMethod]);

  const clearTimerAndStates = useCallback(() => {
    if (timerId) {
      clearInterval(timerId);
      setTimerId(null);
    }
  }, [timerId]);

  useEffect(() => {
    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [timerId]);

  useEffect(() => {
    const handleKeepAwake = async () => {
      // 检查是否支持KeepAwake
      if (!isKeepAwakeSupported()) {
        // 静默处理，不显示错误
        return;
      }

      try {
        if (isRunning) {
          await KeepAwake.keepAwake();
        } else if (!isRunning && hasStartedOnce) {
          await KeepAwake.allowSleep();
        }
      } catch {
        // 静默处理错误
      }
    };

    handleKeepAwake();

    return () => {
      const cleanup = async () => {
        if (!isKeepAwakeSupported()) {
          return;
        }

        try {
          await KeepAwake.allowSleep();
        } catch {
          // 静默处理错误
        }
      };
      cleanup();
    };
  }, [isRunning, hasStartedOnce]);

  // 完成冲煮，显示笔记表单
  const handleComplete = useCallback(() => {
    // 获取当前总时间
    const totalBrewingTime = currentTime;

    // 触发触感反馈
    setTimeout(() => {
      triggerHaptic("success");
    }, 20);

    // 播放完成音效
    playSound("correct");

    // 停止计时器
    clearTimerAndStates();

    // 设置冲煮完成状态
    setIsCompleted(true);
    setShowComplete(true);

    // 发送冲煮完成事件
    window.dispatchEvent(new Event("brewing:complete"));

    // 构造咖啡豆信息
    const coffeeBeanInfo = {
      name: "",
      roastLevel: "中度烘焙",
      roastDate: "",
    };

    if (currentBrewingMethod) {
      // 在冲煮完成时请求最新的参数
      window.dispatchEvent(new CustomEvent("brewing:getParams"));

      // 初始化笔记表单数据
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
        coffeeBeanInfo: coffeeBeanInfo,
        rating: 3, // 默认评分
        taste: {
          acidity: 3,
          sweetness: 3,
          bitterness: 3,
          body: 3,
        },
        coffeeBean: null,
      };

      setNoteFormInitialData(initialData);
    }
  }, [
    clearTimerAndStates,
    onComplete,
    onTimerComplete,
    playSound,
    currentTime,
    isCompleted,
    triggerHaptic,
    currentBrewingMethod,
    selectedEquipment,
  ]);

  // 修改开始计时器函数以使用扩展阶段
  const startMainTimer = useCallback(() => {
    if (currentBrewingMethod) {
      const id = setInterval(() => {
        setCurrentTime((time) => {
          const expandedStages = expandedStagesRef.current;
          const newTime = time + 1;
          const lastStageIndex = expandedStages.length - 1;

          let shouldPlayDing = false;
          let shouldPlayStart = false;
          let shouldNotifyPourEnd = false;
          let shouldPreNotifyPourEnd = false;

          for (let index = 0; index < expandedStages.length; index++) {
            // 阶段开始时播放提示音
            if (newTime === expandedStages[index].startTime) {
              shouldPlayDing = true;
            }

            // 阶段即将结束时播放提示音
            if (
              newTime === expandedStages[index].endTime - 2 ||
              newTime === expandedStages[index].endTime - 1
            ) {
              shouldPlayStart = true;
            }

            // 注水阶段特殊处理
            if (expandedStages[index].type === "pour") {
              const pourEndTime = expandedStages[index].endTime;

              // 注水阶段结束时
              if (newTime === pourEndTime) {
                shouldNotifyPourEnd = true;
              }

              // 注水阶段即将结束时
              if (newTime === pourEndTime - 2 || newTime === pourEndTime - 1) {
                shouldPreNotifyPourEnd = true;
              }
            }
          }

          if (shouldPlayDing) {
            playSound("ding");
          }
          if (shouldPlayStart) {
            playSound("start");
          }
          if (shouldPreNotifyPourEnd) {
            playSound("start");
          }
          if (shouldNotifyPourEnd) {
            playSound("ding");
            if (isHapticsSupported && settings.hapticFeedback) {
              triggerHaptic("medium");
            }
          }

          // 检查是否完成所有阶段
          if (newTime > expandedStages[lastStageIndex].endTime) {
            clearInterval(id);
            setTimerId(null);
            setIsRunning(false);

            // 不要在这里直接调用handleComplete，而是在下一个事件循环中调用
            setTimeout(() => {
              handleComplete();
            }, 0);

            return expandedStages[lastStageIndex].endTime;
          }

          return newTime;
        });
      }, 1000);
      setTimerId(id);
    }
  }, [
    currentBrewingMethod,
    playSound,
    handleComplete,
    triggerHaptic,
    isHapticsSupported,
    settings.hapticFeedback,
  ]);

  // 修改倒计时相关的 useEffect，避免在渲染时发送事件
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

      if (countdownTime > 0) {
        playSound("start");

        const countdownId = setInterval(() => {
          setCountdownTime((prev) => {
            if (prev === null) return null;
            const newCountdown = prev - 1;

            // 移除在这里直接发送事件的代码，让上面的 useEffect 统一处理
            return newCountdown;
          });
        }, 1000);

        return () => clearInterval(countdownId);
      } else {
        // 倒计时结束时，使用setTimeout确保不在渲染期间更新状态
        setTimeout(() => {
          // 先设置为 null
          setCountdownTime(null);

          // 移除在这里直接发送事件的代码，让上面的 useEffect 统一处理

          // 启动主计时器
          playSound("ding");
          startMainTimer();
        }, 0);
      }
    }
  }, [countdownTime, isRunning, playSound, startMainTimer, timerId]);

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

      // 创建新笔记
      const newNote = {
        ...note,
        id: Date.now().toString(),
        timestamp: Date.now(),
      };

      // 将新笔记添加到列表开头
      const updatedNotes = [newNote, ...existingNotes];

      // 存储更新后的笔记列表
      await Storage.set("brewingNotes", JSON.stringify(updatedNotes));

      // 设置笔记已保存标记
      localStorage.setItem("brewingNoteInProgress", "false");
      // 清空表单初始数据，表示已完全保存
      setNoteFormInitialData(null);

      // 关闭笔记表单
      setShowNoteForm(false);
    } catch {
      alert("保存失败，请重试");
    }
  }, []);

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
    setNoteFormInitialData(null);

    // 关闭笔记表单(如果打开的话)
    setShowNoteForm(false);

    // 触发一个事件通知其他组件重置
    const event = new CustomEvent("brewing:reset");
    window.dispatchEvent(event);
  }, [clearTimerAndStates, triggerHaptic]);

  const pauseTimer = useCallback(() => {
    triggerHaptic("light");
    clearTimerAndStates();
    setIsRunning(false);
  }, [clearTimerAndStates, triggerHaptic]);

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
          triggerHaptic("medium");
          setIsRunning(true);

          // 仅更新本地状态，让 useEffect 处理事件分发
          setCountdownTime(3);
          setHasStartedOnce(true);
        }, 100);

        return;
      }

      // 常规启动逻辑
      triggerHaptic("medium");
      setIsRunning(true);

      if (!hasStartedOnce || currentTime === 0) {
        // 仅更新本地状态，让 useEffect 处理事件分发
        setCountdownTime(3);
        setHasStartedOnce(true);
      } else {
        startMainTimer();
      }
    }
  }, [
    isRunning,
    currentBrewingMethod,
    hasStartedOnce,
    startMainTimer,
    currentTime,
    triggerHaptic,
    showComplete,
    isCompleted,
    isCoffeeBrewed,
    resetTimer,
  ]);

  useEffect(() => {
    if (isRunning) {
      const waterAmount = calculateCurrentWater();
      setCurrentWaterAmount(Math.round(waterAmount));
    }
  }, [currentTime, isRunning, calculateCurrentWater]);

  useEffect(() => {
    onStatusChange?.({ isRunning });
  }, [isRunning, onStatusChange]);

  // 修改获取阶段进度的函数
  const getStageProgress = useCallback(
    (stageIndex: number) => {
      if (stageIndex < 0 || expandedStagesRef.current.length === 0) return 0;

      if (stageIndex >= expandedStagesRef.current.length) return 0;

      const stage = expandedStagesRef.current[stageIndex];
      if (!stage) return 0;

      if (currentTime < stage.startTime) return 0;
      if (currentTime > stage.endTime) return 100;

      return (
        ((currentTime - stage.startTime) / (stage.endTime - stage.startTime)) *
        100
      );
    },
    [currentTime]
  );

  // 修改向外通知阶段变化的函数
  useEffect(() => {
    const currentStage = getCurrentStage();
    const progress = getStageProgress(currentStage);

    if (currentStage >= 0 && expandedStagesRef.current.length > 0) {
      const currentExpandedStage = expandedStagesRef.current[currentStage];

      onStageChange?.({
        currentStage: currentStage,
        progress: progress,
        isWaiting: currentExpandedStage.type === "wait",
      });
    }
  }, [currentTime, getCurrentStage, getStageProgress, onStageChange]);

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
      if (e.detail && noteFormInitialData) {
        // 标准化烘焙度值，确保与下拉列表选项匹配
        const normalizeRoastLevel = (roastLevel?: string): string => {
          if (!roastLevel) return "中度烘焙";

          // 如果已经是完整格式，直接返回
          if (roastLevel.endsWith("烘焙")) return roastLevel;

          // 否则添加"烘焙"后缀
          if (roastLevel === "浅度") return "浅度烘焙";
          if (roastLevel === "中浅") return "中浅烘焙";
          if (roastLevel === "中度") return "中度烘焙";
          if (roastLevel === "中深") return "中深烘焙";
          if (roastLevel === "深度") return "深度烘焙";

          // 尝试匹配部分字符串
          if (roastLevel.includes("浅")) return "浅度烘焙";
          if (roastLevel.includes("中浅")) return "中浅烘焙";
          if (roastLevel.includes("中深")) return "中深烘焙";
          if (roastLevel.includes("深")) return "深度烘焙";
          if (roastLevel.includes("中")) return "中度烘焙";

          // 默认返回中度烘焙
          return "中度烘焙";
        };

        // 更新笔记表单数据
        const updatedData: Partial<BrewingNoteData> = {
          ...noteFormInitialData,
        };

        // 更新参数信息
        if (e.detail.params) {
          updatedData.params = {
            coffee:
              e.detail.params.coffee ||
              noteFormInitialData.params?.coffee ||
              "",
            water:
              e.detail.params.water || noteFormInitialData.params?.water || "",
            ratio:
              e.detail.params.ratio || noteFormInitialData.params?.ratio || "",
            grindSize:
              e.detail.params.grindSize ||
              noteFormInitialData.params?.grindSize ||
              "",
            temp:
              e.detail.params.temp || noteFormInitialData.params?.temp || "",
          };
        }

        // 更新咖啡豆信息
        if (e.detail.coffeeBean) {
          updatedData.coffeeBean = {
            ...e.detail.coffeeBean,
            roastLevel: normalizeRoastLevel(e.detail.coffeeBean.roastLevel),
          };
          updatedData.coffeeBeanInfo = {
            name: e.detail.coffeeBean.name || "",
            roastLevel: normalizeRoastLevel(e.detail.coffeeBean.roastLevel),
            roastDate: e.detail.coffeeBean.roastDate || "",
          };
        }

        setNoteFormInitialData(updatedData);
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
  }, [noteFormInitialData]);

  // 触感反馈在阶段变化时
  useEffect(() => {
    const currentStage = getCurrentStage();
    if (
      currentStage !== lastStageRef.current &&
      isRunning &&
      lastStageRef.current !== -1
    ) {
      triggerHaptic("medium");
    }
    lastStageRef.current = currentStage;
  }, [currentTime, getCurrentStage, isRunning, triggerHaptic]);

  // 处理外部显示和关闭笔记表单的事件
  useEffect(() => {
    const handleShowNoteForm = () => {
      setShowNoteForm(true);
    };

    const handleCloseNoteForm = (e: CustomEvent<{ force?: boolean }>) => {
      // 强制关闭时无需询问
      if (e.detail?.force) {
        setShowNoteForm(false);
        return;
      }

      // 常规关闭可添加确认逻辑
      setShowNoteForm(false);
    };

    // 添加事件监听
    window.addEventListener("showBrewingNoteForm", handleShowNoteForm);
    window.addEventListener(
      "closeBrewingNoteForm",
      handleCloseNoteForm as EventListener
    );

    return () => {
      // 移除事件监听
      window.removeEventListener("showBrewingNoteForm", handleShowNoteForm);
      window.removeEventListener(
        "closeBrewingNoteForm",
        handleCloseNoteForm as EventListener
      );
    };
  }, []);

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
        expandedStagesRef.current = createExpandedStages();
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
  }, [isRunning, resetTimer, createExpandedStages]);

  // 在倒计时结束时添加触感反馈
  useEffect(() => {
    if (countdownTime === 0 && isRunning) {
      triggerHaptic("vibrateMultiple");
    }
  }, [countdownTime, isRunning, triggerHaptic]);

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
    const currentStage = getCurrentStage();

    // 只在最后一个阶段且是等待阶段时显示跳过按钮
    const isLastStage = currentStage === lastStageIndex;
    const isWaitingStage =
      isLastStage && expandedStages[lastStageIndex]?.type === "wait";

    setShowSkipButton(isLastStage && isWaitingStage && isRunning);
  }, [currentTime, getCurrentStage, currentBrewingMethod, isRunning]);

  // 计算目标流速
  const calculateTargetFlowRate = useCallback((stage: ExpandedStage | null) => {
    if (!stage || stage.type !== "pour") return 0;
    
    const waterAmount = parseInt(stage.water);
    const prevStageIndex = expandedStagesRef.current.findIndex(s => s.endTime === stage.startTime);
    const prevWater = prevStageIndex >= 0 ? parseInt(expandedStagesRef.current[prevStageIndex].water) : 0;
    const targetWaterDiff = waterAmount - prevWater;
    
    if (stage.time <= 0) return 0;
    return targetWaterDiff / stage.time;
  }, []);

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
    ? calculateTargetFlowRate(currentStage) 
    : 0;
    
  // 直接使用计算好的流速值
  const displayFlowRate = currentFlowRateValue;

  return (
    <>
      <div
        className="px-6 sticky bottom-0 bg-neutral-50 pt-6 dark:bg-neutral-900 pb-safe relative"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 28px)",
        }}
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
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 px-6 py-4  bg-neutral-50 dark:bg-neutral-900 transform-gpu"
              style={{
                willChange: "transform, opacity",
                transform: "translateZ(0)",
                zIndex: 40,
              }}
            >
              {/* 添加渐变阴影 */}
              <div className="absolute -top-12 left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    计时器设置
                  </h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      阶段信息布局反转
                    </span>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={localLayoutSettings?.stageInfoReversed || false}
                        onChange={(e) => {
                          const newSettings = {
                            ...localLayoutSettings,
                            stageInfoReversed: e.target.checked,
                          };
                          setLocalLayoutSettings(newSettings);
                          handleLayoutChange(newSettings);
                        }}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      控制区布局反转
                    </span>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={localLayoutSettings?.controlsReversed || false}
                        onChange={(e) => {
                          const newSettings = {
                            ...localLayoutSettings,
                            controlsReversed: e.target.checked,
                          };
                          setLocalLayoutSettings(newSettings);
                          handleLayoutChange(newSettings);
                        }}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      始终显示计时器信息
                    </span>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={localLayoutSettings?.alwaysShowTimerInfo || false}
                        onChange={(e) => {
                          const newSettings = {
                            ...localLayoutSettings,
                            alwaysShowTimerInfo: e.target.checked,
                          };
                          setLocalLayoutSettings(newSettings);
                          handleLayoutChange(newSettings);
                        }}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      显示阶段分隔线
                    </span>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={localLayoutSettings?.showStageDivider || false}
                        onChange={(e) => {
                          const newSettings = {
                            ...localLayoutSettings,
                            showStageDivider: e.target.checked,
                          };
                          setLocalLayoutSettings(newSettings);
                          handleLayoutChange(newSettings);
                        }}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      显示流速
                    </span>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={localShowFlowRate || false}
                        onChange={(e) => {
                          handleFlowRateSettingChange(e.target.checked);
                        }}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      进度条高度：{localLayoutSettings?.progressBarHeight || 4}px
                    </span>
                    <input
                      type="range"
                      min="2"
                      max="12"
                      step="1"
                      value={localLayoutSettings?.progressBarHeight || 4}
                      onChange={(e) => {
                        const newSettings = {
                          ...localLayoutSettings,
                          progressBarHeight: parseInt(e.target.value),
                        };
                        setLocalLayoutSettings(newSettings);
                        handleLayoutChange(newSettings);
                      }}
                      className="w-full h-1 bg-neutral-200 rounded-full appearance-none cursor-pointer dark:bg-neutral-700"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
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
                                    <span>{calculateTargetFlowRate(nextStage).toFixed(1)}</span>
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
                    className="relative mb-3"
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
                            className="absolute top-0 bottom-0 z-10 w-[1.5px] bg-neutral-100 dark:bg-neutral-700"
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
      <AnimatePresence mode="wait">
        {showNoteForm && currentBrewingMethod && (
          <motion.div
            key="note-form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.26 }}
            className="absolute inset-0 bg-neutral-50 dark:bg-neutral-900"
            style={{
              willChange: "transform, opacity",
              zIndex: 50,
              transform: "translateZ(0)",
            }}
          >
            <BrewingNoteForm
              id="brewingNoteForm"
              isOpen={showNoteForm}
              onClose={() => {
                setShowNoteForm(false);
                // 注意：这里不清除brewingNoteInProgress，保留未完成状态
                // 允许用户稍后返回继续填写
              }}
              onSave={handleSaveNote}
              initialData={
                noteFormInitialData || {
                  equipment: selectedEquipment
                    ? equipmentList.find((e) => e.id === selectedEquipment)
                        ?.name || selectedEquipment
                    : "",
                  method: currentBrewingMethod?.name || "",
                  params: {
                    coffee: currentBrewingMethod?.params?.coffee || "",
                    water: currentBrewingMethod?.params?.water || "",
                    ratio: currentBrewingMethod?.params?.ratio || "",
                    grindSize: currentBrewingMethod?.params?.grindSize || "",
                    temp: currentBrewingMethod?.params?.temp || "",
                  },
                  totalTime: currentTime,
                }
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BrewingTimer;
