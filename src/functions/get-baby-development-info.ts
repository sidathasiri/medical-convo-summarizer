import { AppSyncResolverHandler } from 'aws-lambda';
import { getBabyDevelopmentInfo } from '../services/aiService';

interface BabyDevelopmentInfoArgs {
  ageInMonths: number;
}

interface BabyDevelopmentInfo {
  success: boolean;
  error?: string;
  info: string;
}

export const handler: AppSyncResolverHandler<BabyDevelopmentInfoArgs, BabyDevelopmentInfo> = async (event) => {
  try {
    const { ageInMonths } = event.arguments;

    const content = await getBabyDevelopmentInfo(ageInMonths);
    return {
        success: true,
        info: content
    };
  } catch (error) {
    console.error('Error generating baby development info:', error);
    return {
        success: false,
        info: '',  // Provide an empty string for info in error case
        error: 'Failed to generate baby development information'
    };
  }
};
