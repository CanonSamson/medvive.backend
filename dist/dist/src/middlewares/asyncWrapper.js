const asyncWrapper = (fn) => {
    return async (req, res, next) => {
        try {
            await fn(req, res, next);
        }
        catch (error) {
            next(error);
        }
    };
};
export default asyncWrapper;
//# sourceMappingURL=asyncWrapper.js.map
//# sourceMappingURL=asyncWrapper.js.map