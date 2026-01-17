import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

// 从 localStorage 获取语言偏好，默认中文
const savedLang = typeof window !== 'undefined' ? localStorage.getItem('language') : null;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS }
    },
    lng: savedLang || 'zh-CN', // 默认中文
    fallbackLng: 'zh-CN',
    interpolation: {
      escapeValue: false // React 已经安全处理
    }
  });

export default i18n;

