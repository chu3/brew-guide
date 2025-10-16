/**
 * 磨豆机管理器
 * 提供磨豆机的增删改查功能，统一管理存储操作
 */

import { Storage } from '@/lib/core/storage'
import { SettingsOptions, CustomGrinder } from '@/components/settings/Settings'

const SETTINGS_KEY = 'brewGuideSettings'

/**
 * 磨豆机管理器
 */
export const GrinderManager = {
    /**
     * 获取当前设置
     */
    async getSettings(): Promise<SettingsOptions> {
        try {
            const stored = await Storage.get(SETTINGS_KEY)
            if (stored) {
                return JSON.parse(stored)
            }
            throw new Error('设置不存在')
        } catch (error) {
            console.error('[GrinderManager] 获取设置失败:', error)
            throw error
        }
    },

    /**
     * 保存设置并触发事件
     */
    async saveSettings(settings: SettingsOptions): Promise<void> {
        try {
            await Storage.set(SETTINGS_KEY, JSON.stringify(settings))
            
            // 触发 storageChange 事件（通知其他组件）
            window.dispatchEvent(new CustomEvent('storageChange', {
                detail: { key: SETTINGS_KEY }
            }))
            
            // 触发 settingsReload 事件（通知 Settings 组件重新加载）
            window.dispatchEvent(new CustomEvent('settingsReload'))
        } catch (error) {
            console.error('[GrinderManager] 保存设置失败:', error)
            throw error
        }
    },

    /**
     * 获取我的磨豆机列表
     */
    async getMyGrinders(): Promise<string[]> {
        const settings = await this.getSettings()
        return settings.myGrinders || ['generic']
    },

    /**
     * 获取自定义磨豆机列表
     */
    async getCustomGrinders(): Promise<CustomGrinder[]> {
        const settings = await this.getSettings()
        return settings.customGrinders || []
    },

    /**
     * 添加磨豆机到我的列表
     */
    async addToMyGrinders(grinderId: string): Promise<void> {
        const settings = await this.getSettings()
        const currentList = settings.myGrinders || ['generic']
        
        if (currentList.includes(grinderId)) {
            return
        }
        
        const updatedList = [...currentList, grinderId]
        const newSettings = { ...settings, myGrinders: updatedList }
        
        await this.saveSettings(newSettings)
    },

    /**
     * 从我的列表移除磨豆机
     */
    async removeFromMyGrinders(grinderId: string): Promise<void> {
        const settings = await this.getSettings()
        const currentList = settings.myGrinders || ['generic']
        const updatedList = currentList.filter(id => id !== grinderId)
        
        // 确保至少保留一个磨豆机
        if (updatedList.length === 0) {
            throw new Error('至少需要保留一个磨豆机')
        }
        
        // 如果当前选中的磨豆机被移除，切换到列表中的第一个
        let newGrindType = settings.grindType
        if (settings.grindType === grinderId) {
            newGrindType = updatedList[0]
        }
        
        const newSettings = {
            ...settings,
            myGrinders: updatedList,
            grindType: newGrindType
        }
        
        await this.saveSettings(newSettings)
    },

    /**
     * 添加自定义磨豆机
     */
    async addCustomGrinder(grinder: Omit<CustomGrinder, 'id' | 'isCustom'>): Promise<CustomGrinder> {
        const settings = await this.getSettings()
        const customGrinders = settings.customGrinders || []
        const myGrinders = settings.myGrinders || ['generic']
        
        const newGrinderId = `custom_grinder_${Date.now()}`
        const newGrinder: CustomGrinder = {
            ...grinder,
            id: newGrinderId,
            isCustom: true
        }
        
        const updatedCustomGrinders = [...customGrinders, newGrinder]
        const updatedMyGrinders = [...myGrinders, newGrinderId]
        
        // 一次性更新所有相关字段
        const newSettings = {
            ...settings,
            customGrinders: updatedCustomGrinders,
            myGrinders: updatedMyGrinders,
            grindType: newGrinderId  // 自动选择新创建的磨豆机
        }
        
        await this.saveSettings(newSettings)
        
        return newGrinder
    },

    /**
     * 更新自定义磨豆机
     */
    async updateCustomGrinder(grinderId: string, updates: Partial<Omit<CustomGrinder, 'id' | 'isCustom'>>): Promise<void> {
        const settings = await this.getSettings()
        const customGrinders = settings.customGrinders || []
        
        const index = customGrinders.findIndex(g => g.id === grinderId)
        if (index === -1) {
            throw new Error('自定义磨豆机不存在')
        }
        
        const updatedGrinders = [...customGrinders]
        updatedGrinders[index] = { ...updatedGrinders[index], ...updates }
        
        const newSettings = { ...settings, customGrinders: updatedGrinders }
        
        await this.saveSettings(newSettings)
    },

    /**
     * 删除自定义磨豆机
     */
    async deleteCustomGrinder(grinderId: string): Promise<void> {
        const settings = await this.getSettings()
        const customGrinders = settings.customGrinders || []
        const myGrinders = settings.myGrinders || ['generic']
        
        // 过滤掉要删除的磨豆机
        const updatedCustomGrinders = customGrinders.filter(g => g.id !== grinderId)
        const updatedMyGrinders = myGrinders.filter(id => id !== grinderId)
        
        // 如果当前选中的是被删除的磨豆机，切换到通用
        let newGrindType = settings.grindType
        if (settings.grindType === grinderId) {
            newGrindType = updatedMyGrinders.length > 0 ? updatedMyGrinders[0] : 'generic'
        }
        
        // 一次性更新所有相关字段
        const newSettings = {
            ...settings,
            customGrinders: updatedCustomGrinders,
            myGrinders: updatedMyGrinders,
            grindType: newGrindType
        }
        
        await this.saveSettings(newSettings)
    },

    /**
     * 设置当前使用的磨豆机
     */
    async setCurrentGrinder(grinderId: string): Promise<void> {
        const settings = await this.getSettings()
        const newSettings = { ...settings, grindType: grinderId }
        
        await this.saveSettings(newSettings)
    }
}
