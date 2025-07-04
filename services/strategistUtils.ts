
import type { ProcessState, StrategistLLMContext } from '../types';

// Constants for qualitative state assessment
export const MIN_CHARS_SHORT_PRODUCT_THRESHOLD = 2000;
export const MIN_CHARS_FOR_DEVELOPED_PRODUCT = 2000; // Can be the same as short threshold
export const MIN_CHARS_MATURE_PRODUCT_THRESHOLD = 8000;

export const calculateQualitativeStates = (
    currentProduct: string | null,
    stagnationInfo: ProcessState['stagnationInfo'],
    inputComplexity: ProcessState['inputComplexity'],
    stagnationNudgeAggressiveness: ProcessState['stagnationNudgeAggressiveness'],
    isBootstrappedBase: boolean
): Pick<StrategistLLMContext, 'productDevelopmentState' | 'stagnationSeverity' | 'recentIterationPerformance'> => {
    const currentProductLength = currentProduct?.length || 0;

    let productDevelopmentState: StrategistLLMContext['productDevelopmentState'] = 'UNKNOWN';
    if (stagnationInfo.consecutiveLowValueIterations >= 2 && currentProductLength < MIN_CHARS_FOR_DEVELOPED_PRODUCT) {
        productDevelopmentState = 'NEEDS_EXPANSION_STALLED';
    } else if (currentProductLength < MIN_CHARS_SHORT_PRODUCT_THRESHOLD && (inputComplexity !== 'SIMPLE' || (stagnationInfo.lastMeaningfulChangeProductLength && currentProductLength < stagnationInfo.lastMeaningfulChangeProductLength * 0.7))) {
        productDevelopmentState = 'UNDERDEVELOPED_KERNEL';
    } else if (currentProductLength > MIN_CHARS_MATURE_PRODUCT_THRESHOLD) {
        productDevelopmentState = 'MATURE_PRODUCT';
    } else {
        productDevelopmentState = 'DEVELOPED_DRAFT';
    }

    // A bootstrapped base is, by definition, a developed draft, even if it's short.
    // It's the result of integration, not an initial "kernel" needing raw expansion.
    if (isBootstrappedBase && productDevelopmentState === 'UNDERDEVELOPED_KERNEL') {
        productDevelopmentState = 'DEVELOPED_DRAFT';
    }


    let stagnationSeverity: StrategistLLMContext['stagnationSeverity'] = 'NONE';
    const identThreshold = stagnationNudgeAggressiveness === 'HIGH' ? 1 : (stagnationNudgeAggressiveness === 'MEDIUM' ? 2 : 3);
    const lowValueThresholdSevere = stagnationNudgeAggressiveness === 'HIGH' ? 2 : (stagnationNudgeAggressiveness === 'MEDIUM' ? 3 : 4);
    const stagnantThresholdSevere = stagnationNudgeAggressiveness === 'HIGH' ? 2 : (stagnationNudgeAggressiveness === 'MEDIUM' ? 3 : 4);
    const criticalLowValueThreshold = lowValueThresholdSevere + (stagnationNudgeAggressiveness === 'HIGH' ? 2 : 3);
    
    if (stagnationInfo.consecutiveIdenticalProductIterations >= identThreshold || stagnationInfo.consecutiveLowValueIterations >= criticalLowValueThreshold) {
        stagnationSeverity = 'CRITICAL';
    } else if (stagnationInfo.consecutiveLowValueIterations >= lowValueThresholdSevere || stagnationInfo.consecutiveStagnantIterations >= stagnantThresholdSevere) {
        stagnationSeverity = 'SEVERE';
    } else if (stagnationInfo.consecutiveLowValueIterations >=1 || stagnationInfo.consecutiveStagnantIterations >=1) {
        stagnationSeverity = 'MODERATE';
    } else if (stagnationInfo.isStagnant) {
        stagnationSeverity = 'MILD';
    }

    let recentIterationPerformance: StrategistLLMContext['recentIterationPerformance'] = 'PRODUCTIVE';
    if (stagnationInfo.consecutiveIdenticalProductIterations > 0) {
        recentIterationPerformance = 'STALLED';
    } else if (stagnationInfo.consecutiveLowValueIterations > 0) {
        recentIterationPerformance = 'LOW_VALUE';
    }
    return { productDevelopmentState, stagnationSeverity, recentIterationPerformance };
};