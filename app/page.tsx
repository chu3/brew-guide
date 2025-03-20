'use client'
import React, { useState, useEffect } from 'react'
import { motion as m, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { equipmentList } from '@/lib/config'
import { Storage } from '@/lib/storage'
import type { BrewingNoteData } from '@/app/types'
import { useBrewingState } from '@/lib/hooks/useBrewingState'
import { useBrewingParameters } from '@/lib/hooks/useBrewingParameters'
import { useBrewingContent } from '@/lib/hooks/useBrewingContent'
import { useMethodSelector } from '@/lib/hooks/useMethodSelector'
import { EditableParams } from '@/lib/hooks/useBrewingParameters'
import Settings, { SettingsOptions, defaultSettings } from '@/components/Settings'
import Onboarding from '@/components/Onboarding'
import BottomNavBar from '@/components/BottomNavBar'
import HomePage from '@/components/HomePage'
import BrewingPage from '@/components/BrewingPage'

// 添加内容转换状态类型
interface TransitionState {
    isTransitioning: boolean;
    source: string;
}

// 动态导入客户端组件
const BrewingHistory = dynamic(() => import('@/components/BrewingHistory'), { ssr: false })

// 手冲咖啡配方页面组件
const PourOverRecipes = () => {
    // 使用设置相关状态
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<SettingsOptions>(() => {
        // 使用默认设置作为初始值，稍后在 useEffect 中异步加载
        return defaultSettings;
    });

    // 添加加载状态
    const [isLoading, setIsLoading] = useState(true);
    // 添加引导页面状态
    const [showOnboarding, setShowOnboarding] = useState(false);

    // 添加动画过渡状态
    const [transitionState] = useState<TransitionState>({
        isTransitioning: false,
        source: ''
    });

    // 使用自定义Hooks
    const brewingState = useBrewingState();
    const {
        activeMainTab, setActiveMainTab,
        activeBrewingStep, setActiveBrewingStep,
        activeTab, setActiveTab,
        selectedEquipment,
        selectedMethod, setSelectedMethod,
        currentBrewingMethod, setCurrentBrewingMethod,
        isTimerRunning, setIsTimerRunning,
        currentStage, setCurrentStage,
        showHistory, setShowHistory,
        showComplete, setShowComplete,
        currentTime, setCurrentTime,
        methodType, setMethodType,
        countdownTime, setCountdownTime,
        isPourVisualizerPreloaded,
        customMethods,
        showCustomForm, setShowCustomForm,
        editingMethod,
        actionMenuStates, setActionMenuStates,
        showImportForm, setShowImportForm,
        setIsOptimizing,
        jumpToImport,
        handleBrewingStepClick,
        handleEquipmentSelect,
        handleSaveNote,
        handleSaveCustomMethod,
        handleEditCustomMethod,
        handleDeleteCustomMethod
    } = brewingState;

    const parameterHooks = useBrewingParameters();
    const {
        parameterInfo, setParameterInfo,
        editableParams, setEditableParams,
        handleParamChange
    } = parameterHooks;

    const contentHooks = useBrewingContent({
        selectedEquipment,
        methodType,
        customMethods,
        selectedMethod
    });

    const { content, updateBrewingSteps } = contentHooks;

    const methodSelector = useMethodSelector({
        selectedEquipment,
        methodType,
        customMethods,
        setSelectedMethod,
        setCurrentBrewingMethod,
        setEditableParams,
        setParameterInfo,
        setActiveTab,
        setActiveBrewingStep,
        updateBrewingSteps
    });

    const { handleMethodSelect } = methodSelector;

    // 确保参数信息更新
    useEffect(() => {
        if (selectedEquipment && activeMainTab === '冲煮') {
            const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;
            if (currentBrewingMethod) {
                setParameterInfo({
                    equipment: equipmentName,
                    method: currentBrewingMethod.name,
                    params: {
                        coffee: currentBrewingMethod.params.coffee,
                        water: currentBrewingMethod.params.water,
                        ratio: currentBrewingMethod.params.ratio,
                        grindSize: currentBrewingMethod.params.grindSize,
                        temp: currentBrewingMethod.params.temp
                    }
                });
            } else {
                setParameterInfo({
                    equipment: equipmentName,
                    method: null,
                    params: null
                });
            }
        }
    }, [selectedEquipment, currentBrewingMethod, activeMainTab, setParameterInfo]);

    // 添加异步加载设置的 useEffect
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedSettings = await Storage.get('brewGuideSettings');
                if (savedSettings) {
                    setSettings(JSON.parse(savedSettings) as SettingsOptions);
                }

                // 检查是否需要显示引导页面
                const hasCompletedOnboarding = await Storage.get('hasCompletedOnboarding');
                setShowOnboarding(!hasCompletedOnboarding);

                setIsLoading(false);
            } catch (error) {
                console.error('Error loading settings:', error);
                setIsLoading(false);
            }
        };

        loadSettings();
    }, []);

    // 处理参数变更的包装函数，修复any类型问题
    const handleParamChangeWrapper = (type: keyof EditableParams, value: string) => {
        handleParamChange(
            type,
            value,
            selectedMethod,
            currentBrewingMethod,
            updateBrewingSteps,
            setCurrentBrewingMethod
        );
    };

    // 处理保存笔记的包装函数
    const handleSaveNoteWrapper = async (data: BrewingNoteData) => {
        await handleSaveNote(data);
    };

    // 处理装备选择的包装函数
    const handleEquipmentSelectWithName = (equipmentName: string) => {
        handleEquipmentSelect(equipmentName);
    };

    // 包装处理冲煮步骤点击的函数
    const handleBrewingStepClickWrapper = (step: 'equipment' | 'method' | 'brewing' | 'notes') => {
        handleBrewingStepClick(step);
    };

    // 处理方案选择的包装函数
    const handleMethodSelectWrapper = (index: number) => {
        handleMethodSelect(index);
    };

    // 处理设置变更
    const handleSettingsChange = async (newSettings: SettingsOptions) => {
        try {
            await Storage.set('brewGuideSettings', JSON.stringify(newSettings));
            setSettings(newSettings);
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    };

    // 处理引导完成事件
    const handleOnboardingComplete = async () => {
        try {
            await Storage.set('hasCompletedOnboarding', 'true');
            setShowOnboarding(false);
        } catch (error) {
            console.error('Error saving onboarding status:', error);
        }
    };

    // 添加冲煮页面显示状态
    const [showBrewingPage, setShowBrewingPage] = useState(false);

    // 添加上一个标签状态
    const [prevMainTab, setPrevMainTab] = useState<'首页' | '冲煮' | '笔记'>('首页');

    // 处理冲煮按钮点击
    const handleBrewingClick = () => {
        // 保存当前活动标签
        setPrevMainTab(activeMainTab);
        // 设置activeMainTab为'冲煮'用于内部状态管理
        setActiveMainTab('冲煮');
        // 显示全屏冲煮页面
        setShowBrewingPage(true);
    };

    // 处理冲煮页面关闭
    const handleBrewingClose = () => {
        // 隐藏冲煮页面
        setShowBrewingPage(false);
        // 恢复到之前的标签页
        setActiveMainTab(prevMainTab);
    };

    return (
        <div className="min-h-screen w-full overflow-hidden flex flex-col pt-safe relative mx-auto max-w-[500px] font-mono text-neutral-800 dark:text-neutral-100">
            {/* 加载初始设置或显示引导页面 */}
            {showOnboarding ? (
                <Onboarding
                    onSettingsChange={handleSettingsChange}
                    onComplete={handleOnboardingComplete}
                />
            ) : isLoading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neutral-800 dark:border-neutral-200"></div>
                    <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">加载数据中...</p>
                </div>
            ) : (
                <>
                    {/* 设置面板 */}
                    <Settings
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        settings={settings}
                        setSettings={setSettings}
                        onDataChange={() => { }} // 暂时传递空函数
                    />

                    {/* 全屏冲煮页面 */}
                    <AnimatePresence>
                        {showBrewingPage && (
                            <BrewingPage
                                onClose={handleBrewingClose}
                                activeBrewingStep={activeBrewingStep}
                                setActiveBrewingStep={handleBrewingStepClickWrapper}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                parameterInfo={parameterInfo}
                                setParameterInfo={setParameterInfo}
                                editableParams={editableParams}
                                setEditableParams={setEditableParams}
                                isTimerRunning={isTimerRunning}
                                setIsTimerRunning={setIsTimerRunning}
                                showComplete={showComplete}
                                setShowComplete={setShowComplete}
                                selectedEquipment={selectedEquipment}
                                selectedMethod={selectedMethod}
                                currentBrewingMethod={currentBrewingMethod}
                                currentStage={currentStage}
                                setCurrentStage={setCurrentStage}
                                currentTime={currentTime}
                                setCurrentTime={setCurrentTime}
                                countdownTime={countdownTime}
                                setCountdownTime={setCountdownTime}
                                methodType={methodType}
                                setMethodType={setMethodType}
                                isPourVisualizerPreloaded={isPourVisualizerPreloaded}
                                customMethods={customMethods}
                                actionMenuStates={actionMenuStates}
                                setActionMenuStates={setActionMenuStates}
                                showCustomForm={showCustomForm}
                                setShowCustomForm={setShowCustomForm}
                                showImportForm={showImportForm}
                                setShowImportForm={setShowImportForm}
                                settings={settings}
                                content={content}
                                transitionState={transitionState}
                                handleParamChange={handleParamChangeWrapper}
                                handleSaveNote={handleSaveNoteWrapper}
                                handleEquipmentSelect={handleEquipmentSelectWithName}
                                handleMethodSelect={handleMethodSelectWrapper}
                                handleEditCustomMethod={handleEditCustomMethod}
                                handleDeleteCustomMethod={handleDeleteCustomMethod}
                                jumpToImport={jumpToImport}
                                handleSaveCustomMethod={handleSaveCustomMethod}
                                editingMethod={editingMethod}
                            />
                        )}
                    </AnimatePresence>

                    {/* 页面主内容 */}
                    <div className="flex-1 overflow-y-auto">
                        <AnimatePresence mode="wait">
                            {/* 首页内容 */}
                            {activeMainTab === '首页' && (
                                <m.div
                                    key="home-content"
                                    className="h-full"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <HomePage />
                                </m.div>
                            )}

                            {/* 笔记内容 */}
                            {(activeMainTab === '笔记' || showHistory) && (
                                <m.div
                                    key="history-content"
                                    className="w-full h-full absolute inset-0"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <BrewingHistory
                                        isOpen={true}
                                        onClose={() => setShowHistory(false)}
                                        onOptimizingChange={(isOptimizing) => setIsOptimizing(isOptimizing)}
                                        onJumpToImport={jumpToImport}
                                    />
                                </m.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* 底部导航栏 */}
                    <BottomNavBar
                        activeMainTab={activeMainTab}
                        setActiveMainTab={(tab) => {
                            if (tab === '冲煮') {
                                handleBrewingClick();
                            } else {
                                setActiveMainTab(tab);
                                if (tab === '笔记') {
                                    setShowHistory(true);
                                }
                            }
                        }}
                        setShowHistory={setShowHistory}
                        settings={settings}
                    />
                </>
            )}
        </div>
    )
}

export default PourOverRecipes 