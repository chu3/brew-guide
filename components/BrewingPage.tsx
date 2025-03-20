'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BrewingHeader from '@/components/BrewingHeader'
import TabContent from '@/components/TabContent'
import BrewingTimer from '@/components/BrewingTimer'
import BrewingNoteForm from '@/components/BrewingNoteForm'
import MethodTypeSelector from '@/components/MethodTypeSelector'
import CustomMethodFormModal from '@/components/CustomMethodFormModal'
import { Method, equipmentList } from '@/lib/config'
import { SettingsOptions } from '@/components/Settings'
import type { BrewingNoteData } from '@/app/types'
import { MainTabType, TabType, BrewingStep } from '@/lib/hooks/useBrewingState'

interface BrewingPageProps {
    onClose: () => void
    activeBrewingStep: BrewingStep
    setActiveBrewingStep: (step: BrewingStep) => void
    activeTab: TabType
    setActiveTab: (tab: TabType) => void
    parameterInfo: any
    setParameterInfo: (info: any) => void
    editableParams: any
    setEditableParams: (params: any) => void
    isTimerRunning: boolean
    setIsTimerRunning: (running: boolean) => void
    showComplete: boolean
    setShowComplete: (complete: boolean) => void
    selectedEquipment: string | null
    selectedMethod: Method | null
    currentBrewingMethod: Method | null
    currentStage: number
    setCurrentStage: (stage: number) => void
    currentTime: number
    setCurrentTime: (time: number) => void
    countdownTime: number | null
    setCountdownTime: (time: number | null) => void
    methodType: 'common' | 'custom'
    setMethodType: (type: 'common' | 'custom') => void
    isPourVisualizerPreloaded: boolean
    customMethods: Record<string, Method[]>
    actionMenuStates: Record<string, boolean>
    setActionMenuStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    showCustomForm: boolean
    setShowCustomForm: (show: boolean) => void
    showImportForm: boolean
    setShowImportForm: (show: boolean) => void
    settings: SettingsOptions
    content: any
    transitionState: any
    handleParamChange: (type: any, value: string) => void
    handleSaveNote: (data: BrewingNoteData) => Promise<void>
    handleEquipmentSelect: (equipmentName: string) => void
    handleMethodSelect: (index: number) => void
    handleEditCustomMethod: (method: Method) => void
    handleDeleteCustomMethod: (method: Method) => void
    jumpToImport: () => void
    handleSaveCustomMethod: (method: Method) => void
    editingMethod: Method | undefined
}

const BrewingPage: React.FC<BrewingPageProps> = ({
    onClose,
    activeBrewingStep,
    setActiveBrewingStep,
    activeTab,
    setActiveTab,
    parameterInfo,
    setParameterInfo,
    editableParams,
    setEditableParams,
    isTimerRunning,
    setIsTimerRunning,
    showComplete,
    setShowComplete,
    selectedEquipment,
    selectedMethod,
    currentBrewingMethod,
    currentStage,
    setCurrentStage,
    currentTime,
    setCurrentTime,
    countdownTime,
    setCountdownTime,
    methodType,
    setMethodType,
    isPourVisualizerPreloaded,
    customMethods,
    actionMenuStates,
    setActionMenuStates,
    showCustomForm,
    setShowCustomForm,
    showImportForm,
    setShowImportForm,
    settings,
    content,
    transitionState,
    handleParamChange,
    handleSaveNote,
    handleEquipmentSelect,
    handleMethodSelect,
    handleEditCustomMethod,
    handleDeleteCustomMethod,
    jumpToImport,
    handleSaveCustomMethod,
    editingMethod
}) => {
    return (
        <motion.div
            className="fixed inset-0 z-[100] bg-neutral-50 dark:bg-neutral-900 overflow-hidden flex flex-col"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            style={{
                paddingTop: 'max(env(safe-area-inset-top), 0px)',
                paddingBottom: 'max(env(safe-area-inset-bottom), 0px)'
            }}
        >
            {/* 自定义方案表单弹窗 */}
            <CustomMethodFormModal
                showCustomForm={showCustomForm}
                showImportForm={showImportForm}
                editingMethod={editingMethod}
                selectedEquipment={selectedEquipment}
                customMethods={customMethods}
                onSaveCustomMethod={handleSaveCustomMethod}
                onCloseCustomForm={() => setShowCustomForm(false)}
                onCloseImportForm={() => setShowImportForm(false)}
            />

            {/* 返回按钮 */}
            <div className="sticky top-0 z-20 px-4 py-4 flex items-center">
                <button
                    onClick={onClose}
                    className="h-8 w-8 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"
                >
                    <svg className="h-5 w-5 text-neutral-600 dark:text-neutral-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <h1 className="ml-4 text-base font-light">手冲咖啡</h1>
            </div>

            {/* 冲煮头部 */}
            <BrewingHeader
                activeBrewingStep={activeBrewingStep}
                setActiveBrewingStep={setActiveBrewingStep}
                parameterInfo={parameterInfo}
                setParameterInfo={setParameterInfo}
                editableParams={editableParams}
                setEditableParams={setEditableParams}
                isTimerRunning={isTimerRunning}
                showComplete={showComplete}
                selectedEquipment={selectedEquipment}
                selectedMethod={selectedMethod}
                handleParamChange={handleParamChange}
                setActiveTab={setActiveTab}
                settings={settings}
            />

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait" initial={false}>
                    {activeBrewingStep === 'notes' && selectedMethod ? (
                        <BrewingNoteForm
                            key="notes-form"
                            id="brewingNoteForm"
                            isOpen={true}
                            onClose={() => {
                                // 用户取消记录，返回到注水页面
                                setActiveTab('注水');
                                setActiveBrewingStep('brewing');
                            }}
                            onSave={handleSaveNote}
                            initialData={{
                                equipment: selectedEquipment ? (equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment) : undefined,
                                method: currentBrewingMethod?.name,
                                params: currentBrewingMethod?.params,
                                totalTime: currentTime
                            }}
                            onJumpToImport={jumpToImport}
                        />
                    ) : (
                        <TabContent
                            key="tab-content"
                            activeMainTab={'冲煮' as MainTabType}
                            activeTab={activeTab}
                            content={content}
                            selectedMethod={selectedMethod}
                            currentBrewingMethod={currentBrewingMethod}
                            isTimerRunning={isTimerRunning}
                            showComplete={showComplete}
                            currentStage={currentStage}
                            isPourVisualizerPreloaded={isPourVisualizerPreloaded}
                            selectedEquipment={selectedEquipment}
                            countdownTime={countdownTime}
                            methodType={methodType}
                            customMethods={customMethods}
                            actionMenuStates={actionMenuStates}
                            setActionMenuStates={setActionMenuStates}
                            showCustomForm={showCustomForm}
                            setShowCustomForm={setShowCustomForm}
                            showImportForm={showImportForm}
                            setShowImportForm={setShowImportForm}
                            settings={settings}
                            onEquipmentSelect={handleEquipmentSelect}
                            onMethodSelect={handleMethodSelect}
                            onEditMethod={handleEditCustomMethod}
                            onDeleteMethod={handleDeleteCustomMethod}
                            transitionState={transitionState}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* 方案类型选择器 - 在方案步骤时显示 */}
            {activeBrewingStep === 'method' && selectedEquipment && (
                <MethodTypeSelector
                    methodType={methodType}
                    settings={settings}
                    onSelectMethodType={setMethodType}
                />
            )}

            {/* 计时器组件 - 在注水步骤时显示 */}
            {activeBrewingStep === 'brewing' && selectedMethod && (
                <BrewingTimer
                    key="brewing-timer"
                    currentBrewingMethod={currentBrewingMethod}
                    onStatusChange={({ isRunning }) => setIsTimerRunning(isRunning)}
                    onStageChange={({ currentStage }) => {
                        setCurrentStage(currentStage)
                    }}
                    onComplete={(isComplete, totalTime) => {
                        setShowComplete(isComplete)
                        setCurrentTime(totalTime || 0)
                    }}
                    onCountdownChange={(time) => setCountdownTime(time)}
                    settings={settings}
                    onJumpToImport={jumpToImport}
                />
            )}
        </motion.div>
    )
}

export default BrewingPage 