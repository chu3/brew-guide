import React from 'react';
import { motion } from 'framer-motion';

const HomePage: React.FC = () => {
    return (
        <motion.div
            className="h-full flex flex-col items-center justify-center px-6 py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                </div>
                <h1 className="text-xl font-light mb-3">首页</h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">正在开发中，敬请期待...</p>
            </div>
        </motion.div>
    );
};

export default HomePage; 