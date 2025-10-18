import axios from 'axios';
import logger from '../utils/logger.js';
export class AlatPayService {
    constructor() {
        this.baseUrl = null;
        this.subscriptionKey = null;
        this.businessId = null;
    }
    initialize() {
        if (this.baseUrl === null || this.subscriptionKey === null) {
            this.baseUrl = process.env.ALATPAY_BASE_URL || "";
            this.subscriptionKey = process.env.ALATPAY_SUBSCRIPTION_KEY || '';
            this.businessId = process.env.ALATPAY_BUSINESS_ID || '';
            if (!this.subscriptionKey) {
                logger.error('AlatPay subscription key not configured', {
                    ALATPAY_BASE_URL: process.env.ALATPAY_BASE_URL,
                    ALATPAY_SUBSCRIPTION_KEY_EXISTS: !!process.env.ALATPAY_SUBSCRIPTION_KEY
                });
                throw new Error('AlatPay subscription key is required');
            }
            logger.info('AlatPay service initialized', {
                baseUrl: this.baseUrl,
                hasSubscriptionKey: !!this.subscriptionKey
            });
        }
    }
    /**
     * Confirm transaction status for bank transfer payments
     */
    async confirmTransactionStatus(transactionId) {
        this.initialize(); // Ensure service is initialized
        logger.info("Confirming transaction status", {
            transactionId
        });
        try {
            const response = await axios.get(`${this.baseUrl}/bank-transfer/api/v1/bankTransfer/transactions/${transactionId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': this.subscriptionKey
                },
                timeout: 30000 // 30 second timeout
            });
            logger.info("Transaction status retrieved successfully", {
                transactionId,
                status: response.data?.data?.status,
                response: response.data
            });
            return {
                success: true,
                data: response.data.data
            };
        }
        catch (error) {
            logger.error("Failed to retrieve transaction status", {
                error: error instanceof Error ? error.message : error,
                transactionId,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });
            return {
                success: false,
                error: error.response?.data?.message ||
                    error.message ||
                    'Failed to retrieve transaction status'
            };
        }
    }
    /**
     * Generate a virtual account for bank transfer payments
     * @param request - Virtual account request data
     * @returns Promise<VirtualAccountResponse>
     */
    async generateVirtualAccount(request) {
        this.initialize(); // Ensure service is initialized
        logger.info('Generating virtual account', {
            amount: request.amount,
            currency: request.currency,
            orderId: request.orderId,
            customerEmail: request.customer.email
        });
        try {
            // Prepare the request payload with proper metadata serialization
            const requestPayload = {
                ...request,
                businessId: this.businessId,
                customer: {
                    ...request.customer,
                    // Convert metadata object to JSON string if it exists
                    metadata: request.customer.metadata
                        ? JSON.stringify(request.customer.metadata)
                        : undefined
                }
            };
            const response = await axios.post(`${this.baseUrl}/bank-transfer/api/v1/bankTransfer/virtualAccount`, requestPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': this.subscriptionKey
                },
                timeout: 30000 // 30 seconds timeout
            });
            logger.info('Virtual account generated successfully', {
                orderId: request.orderId,
                reference: response.data?.data?.reference
            });
            return {
                success: true,
                data: response.data?.data
            };
        }
        catch (error) {
            logger.error('Error generating virtual account', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                orderId: request.orderId,
                businessId: this.businessId,
                error
            });
            return {
                success: false,
                error: error.response?.data?.message ||
                    error.message ||
                    'Failed to generate virtual account'
            };
        }
    }
    /**
     * Validate required environment variables
     */
    static validateConfig() {
        const requiredEnvVars = [
            'ALATPAY_BASE_URL',
            'ALATPAY_SUBSCRIPTION_KEY',
            'ALATPAY_BUSINESS_ID'
        ];
        const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
        if (missing.length > 0) {
            logger.error('Missing required AlertPay environment variables', {
                missing
            });
            return false;
        }
        return true;
    }
    /**
     * Get service configuration status
     */
    getConfigStatus() {
        this.initialize(); // Ensure service is initialized
        return {
            baseUrl: this.baseUrl,
            hasSubscriptionKey: !!this.subscriptionKey,
            isConfigured: AlatPayService.validateConfig()
        };
    }
}
export const alatPayService = new AlatPayService();
//# sourceMappingURL=alatPayService.js.map
//# sourceMappingURL=alatPayService.js.map