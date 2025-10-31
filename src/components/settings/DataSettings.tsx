'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { ButtonGroup } from '../ui/ButtonGroup';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import {
  BackupReminderSettings,
  BackupReminderUtils,
  BACKUP_REMINDER_INTERVALS,
  BackupReminderInterval,
} from '@/lib/utils/backupReminderUtils';
import hapticsUtils from '@/lib/ui/haptics';
import {
  S3SyncSection,
  WebDAVSyncSection,
  DataManagementSection,
  ToolsSection,
} from './data-settings';

type S3SyncSettings = NonNullable<SettingsOptions['s3Sync']>;
type WebDAVSyncSettings = NonNullable<SettingsOptions['webdavSync']>;

const normalizeS3Settings = (
  incoming?: SettingsOptions['s3Sync'] | null
): S3SyncSettings => {
  const defaults = {
    enabled: false,
    accessKeyId: '',
    secretAccessKey: '',
    region: 'cn-south-1',
    bucketName: '',
    prefix: 'brew-guide-data/',
    endpoint: '',
    syncMode: 'manual' as const,
  };

  if (!incoming) {
    return { ...defaults };
  }

  const sanitizedRecord = { ...(incoming || {}) } as Record<string, unknown>;
  delete sanitizedRecord.autoSync;
  delete sanitizedRecord.syncInterval;

  const withDefaults: S3SyncSettings = {
    ...defaults,
    ...(sanitizedRecord as Partial<S3SyncSettings>),
    syncMode: 'manual',
  };

  return {
    ...withDefaults,
    endpoint: withDefaults.endpoint || '',
  };
};

const normalizeWebDAVSettings = (
  incoming?: SettingsOptions['webdavSync'] | null
): WebDAVSyncSettings => {
  const defaults = {
    enabled: false,
    url: '',
    username: '',
    password: '',
    remotePath: 'brew-guide-data/',
    syncMode: 'manual' as const,
  };

  if (!incoming) {
    return { ...defaults };
  }

  return {
    ...defaults,
    ...incoming,
    syncMode: 'manual',
  };
};

interface DataSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
  onDataChange?: () => void;
}

const DataSettings: React.FC<DataSettingsProps> = ({
  settings,
  onClose,
  handleChange,
  onDataChange,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 动画状态
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 冲突弹窗
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictRemoteTime, setConflictRemoteTime] = useState<number | null>(
    null
  );
  useThemeColor({ useOverlay: true, enabled: showConflictModal });

  // 云同步设置
  const [s3Settings, setS3Settings] = useState<S3SyncSettings>(() =>
    normalizeS3Settings(settings.s3Sync)
  );
  const [webdavSettings, setWebDAVSettings] = useState<WebDAVSyncSettings>(() =>
    normalizeWebDAVSettings(settings.webdavSync)
  );

  // 备份提醒设置
  const [backupReminderSettings, setBackupReminderSettings] =
    useState<BackupReminderSettings | null>(null);
  const [nextReminderText, setNextReminderText] = useState('');

  // 云同步类型选择
  const [showSyncTypeDropdown, setShowSyncTypeDropdown] = useState(false);
  const syncType = s3Settings.enabled
    ? 's3'
    : webdavSettings.enabled
      ? 'webdav'
      : 'none';

  // 历史栈管理
  useEffect(() => {
    window.history.pushState({ modal: 'data-settings' }, '');
    const handlePopState = () => onCloseRef.current();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 动画初始化
  useEffect(() => {
    setShouldRender(true);
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // 加载备份提醒设置
  useEffect(() => {
    const loadBackupReminderSettings = async () => {
      try {
        const reminderSettings = await BackupReminderUtils.getSettings();
        setBackupReminderSettings(reminderSettings);
        const nextText = await BackupReminderUtils.getNextReminderText();
        setNextReminderText(nextText);
      } catch (error) {
        console.error('加载备份提醒设置失败:', error);
      }
    };
    loadBackupReminderSettings();
  }, []);

  // 同步设置到父组件
  useEffect(() => {
    if (settings.s3Sync) {
      setS3Settings(normalizeS3Settings(settings.s3Sync));
    }
  }, [settings.s3Sync]);

  useEffect(() => {
    if (settings.webdavSync) {
      setWebDAVSettings(normalizeWebDAVSettings(settings.webdavSync));
    }
  }, [settings.webdavSync]);

  // 关闭处理
  const handleClose = () => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      if (window.history.state?.modal === 'data-settings') {
        window.history.back();
      } else {
        onClose();
      }
    }, 350);
  };

  // S3 设置变更处理
  const handleS3SettingChange = <K extends keyof S3SyncSettings>(
    key: K,
    value: S3SyncSettings[K]
  ) => {
    const newS3Settings = normalizeS3Settings({
      ...s3Settings,
      [key]: value,
      // 只有当修改配置参数时才清除连接状态，改变 enabled 或 lastConnectionSuccess 本身时保持原值
      lastConnectionSuccess:
        key === 'enabled' || key === 'lastConnectionSuccess'
          ? key === 'lastConnectionSuccess'
            ? value
            : s3Settings.lastConnectionSuccess
          : false,
    } as S3SyncSettings);
    setS3Settings(newS3Settings);
    handleChange('s3Sync', newS3Settings);
  };

  // WebDAV 设置变更处理
  const handleWebDAVSettingChange = <K extends keyof WebDAVSyncSettings>(
    key: K,
    value: WebDAVSyncSettings[K]
  ) => {
    const newWebDAVSettings = normalizeWebDAVSettings({
      ...webdavSettings,
      [key]: value,
      // 只有当修改配置参数时才清除连接状态，改变 enabled 或 lastConnectionSuccess 本身时保持原值
      lastConnectionSuccess:
        key === 'enabled' || key === 'lastConnectionSuccess'
          ? key === 'lastConnectionSuccess'
            ? value
            : webdavSettings.lastConnectionSuccess
          : false,
    } as WebDAVSyncSettings);
    setWebDAVSettings(newWebDAVSettings);
    handleChange('webdavSync', newWebDAVSettings);
  };

  // 备份提醒设置变更
  const handleBackupReminderChange = async (enabled: boolean) => {
    try {
      await BackupReminderUtils.setEnabled(enabled);
      const updatedSettings = await BackupReminderUtils.getSettings();
      setBackupReminderSettings(updatedSettings);
      const nextText = await BackupReminderUtils.getNextReminderText();
      setNextReminderText(nextText);
      if (settings.hapticFeedback) hapticsUtils.light();
    } catch (error) {
      console.error('更新备份提醒设置失败:', error);
    }
  };

  const handleBackupIntervalChange = async (
    interval: BackupReminderInterval
  ) => {
    try {
      await BackupReminderUtils.updateInterval(interval);
      const updatedSettings = await BackupReminderUtils.getSettings();
      setBackupReminderSettings(updatedSettings);
      const nextText = await BackupReminderUtils.getNextReminderText();
      setNextReminderText(nextText);
      if (settings.hapticFeedback) hapticsUtils.light();
    } catch (error) {
      console.error('更新备份提醒间隔失败:', error);
    }
  };

  // 冲突解决
  const handleConflictResolution = async (direction: 'upload' | 'download') => {
    setShowConflictModal(false);
    // 这里需要触发S3组件的同步
    window.dispatchEvent(
      new CustomEvent('s3ConflictResolved', { detail: { direction } })
    );
  };

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 mx-auto flex max-w-[500px] flex-col bg-neutral-50 dark:bg-neutral-900"
      style={getChildPageStyle(isVisible)}
    >
      {/* 头部导航栏 */}
      <div className="pt-safe-top relative flex items-center justify-center py-4">
        <button
          onClick={handleClose}
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 dark:text-neutral-300"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
          数据管理
        </h2>
      </div>

      {/* 滚动内容区域 */}
      <div className="pb-safe-bottom relative flex-1 divide-y divide-neutral-200 overflow-y-auto dark:divide-neutral-800">
        {/* 顶部渐变阴影 */}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        {/* 云同步设置组 */}
        <div className="-mt-4 px-6 py-4">
          <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            云同步
          </h3>

          <div className="space-y-3">
            {/* 云同步类型选择 */}
            <div className="relative">
              <button
                onClick={() => setShowSyncTypeDropdown(!showSyncTypeDropdown)}
                className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                <span>同步服务</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {syncType === 's3'
                      ? 'S3 对象存储'
                      : syncType === 'webdav'
                        ? 'WebDAV'
                        : '不使用'}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 text-neutral-400 transition-transform ${showSyncTypeDropdown ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>

              {/* 下拉选项 */}
              {showSyncTypeDropdown && (
                <div className="mt-2 space-y-2 rounded bg-neutral-100 p-2 dark:bg-neutral-800">
                  <button
                    onClick={() => {
                      handleS3SettingChange('enabled', false);
                      handleWebDAVSettingChange('enabled', false);
                      setShowSyncTypeDropdown(false);
                      if (settings.hapticFeedback) hapticsUtils.light();
                    }}
                    className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                      syncType === 'none'
                        ? 'bg-neutral-200 font-medium text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
                        : 'text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700'
                    }`}
                  >
                    不使用
                  </button>
                  <button
                    onClick={() => {
                      handleS3SettingChange('enabled', true);
                      handleWebDAVSettingChange('enabled', false);
                      setShowSyncTypeDropdown(false);
                      if (settings.hapticFeedback) hapticsUtils.light();
                    }}
                    className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                      syncType === 's3'
                        ? 'bg-neutral-200 font-medium text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
                        : 'text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700'
                    }`}
                  >
                    S3 对象存储
                  </button>
                  <button
                    onClick={() => {
                      handleWebDAVSettingChange('enabled', true);
                      handleS3SettingChange('enabled', false);
                      setShowSyncTypeDropdown(false);
                      if (settings.hapticFeedback) hapticsUtils.light();
                    }}
                    className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                      syncType === 'webdav'
                        ? 'bg-neutral-200 font-medium text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
                        : 'text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700'
                    }`}
                  >
                    WebDAV
                  </button>
                </div>
              )}
            </div>

            {/* S3 详细设置 */}
            {s3Settings.enabled && (
              <S3SyncSection
                settings={s3Settings}
                enabled={s3Settings.enabled}
                hapticFeedback={settings.hapticFeedback}
                onSettingChange={handleS3SettingChange}
                onSyncComplete={onDataChange}
                onConflict={time => {
                  setConflictRemoteTime(time);
                  setShowConflictModal(true);
                }}
                onEnable={() => {
                  handleS3SettingChange('enabled', true);
                  handleWebDAVSettingChange('enabled', false);
                }}
              />
            )}

            {/* WebDAV 详细设置 */}
            {webdavSettings.enabled && (
              <WebDAVSyncSection
                settings={webdavSettings}
                enabled={webdavSettings.enabled}
                hapticFeedback={settings.hapticFeedback}
                onSettingChange={handleWebDAVSettingChange}
                onSyncComplete={onDataChange}
                onEnable={() => {
                  handleWebDAVSettingChange('enabled', true);
                  handleS3SettingChange('enabled', false);
                }}
              />
            )}
          </div>
        </div>

        {/* 备份提醒设置组 */}
        {backupReminderSettings && (
          <div className="px-6 py-4">
            <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
              备份提醒
            </h3>

            <div className="space-y-3">
              {/* 备份提醒开关 */}
              <div className="flex items-center justify-between rounded bg-neutral-100 px-4 py-3 dark:bg-neutral-800">
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  备份提醒
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={backupReminderSettings.enabled}
                    onChange={e => {
                      handleBackupReminderChange(e.target.checked);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                </label>
              </div>

              {/* 展开的频率设置 */}
              {backupReminderSettings.enabled && (
                <div className="space-y-2 rounded bg-neutral-100 p-4 dark:bg-neutral-800">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      提醒频率
                    </div>
                    {nextReminderText && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {nextReminderText}
                      </div>
                    )}
                  </div>
                  <ButtonGroup
                    value={backupReminderSettings.interval.toString()}
                    options={[
                      {
                        value: BACKUP_REMINDER_INTERVALS.WEEKLY.toString(),
                        label: '每周',
                      },
                      {
                        value: BACKUP_REMINDER_INTERVALS.BIWEEKLY.toString(),
                        label: '每两周',
                      },
                      {
                        value: BACKUP_REMINDER_INTERVALS.MONTHLY.toString(),
                        label: '每月',
                      },
                    ]}
                    onChange={value =>
                      handleBackupIntervalChange(
                        parseInt(value) as BackupReminderInterval
                      )
                    }
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 数据管理设置组 */}
        <DataManagementSection onDataChange={onDataChange} />

        {/* 工具设置组 */}
        <ToolsSection onDataChange={onDataChange} />
      </div>

      {/* 冲突解决模态框 */}
      {showConflictModal && (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/50"
          onClick={() => setShowConflictModal(false)}
        >
          <div
            className="pb-safe-bottom mx-auto w-full max-w-[500px] rounded-t-2xl bg-neutral-100 p-5 shadow-2xl dark:bg-neutral-800"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="mb-4 text-center">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                检测到数据冲突
              </h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                本地和云端都有数据，请选择保留哪一方
              </p>
              {!conflictRemoteTime && (
                <p className="mt-2 rounded bg-orange-50 px-3 py-2 text-xs text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                  💡 首次同步：通常建议下载云端数据
                </p>
              )}
            </div>

            <div className="mb-4 space-y-3">
              <div className="rounded border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  📥 云端数据
                </p>
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                  {conflictRemoteTime
                    ? `最后更新：${new Date(conflictRemoteTime).toLocaleString(
                        'zh-CN',
                        {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}`
                    : '云端有数据'}
                </p>
              </div>
              <div className="rounded bg-neutral-200/60 p-4 dark:bg-neutral-900/60">
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  📱 本地数据
                </p>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  当前设备上的数据
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleConflictResolution('download')}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                ⬇️ 下载云端数据（推荐）
              </button>
              <button
                onClick={() => handleConflictResolution('upload')}
                className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
              >
                ⬆️ 上传本地数据
              </button>
              <p className="pt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
                ⚠️ 选择后将覆盖另一方的数据，请谨慎操作
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataSettings;
