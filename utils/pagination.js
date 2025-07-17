module.exports = function paginate(baseUrl, currentPage, limit, totalItems, query = {}) {
    const totalPages = Math.ceil(totalItems / limit);
    const pages = [];

    for (let i = 1; i <= totalPages; i++) {
        const q = new URLSearchParams({
            ...query,
            page: i
        });
        pages.push({
            number: i,
            url: `${baseUrl}?${q.toString()}`,
            isCurrent: i == currentPage
        });
    }

    return {
        totalItems,
        totalPages,
        currentPage,
        pages
    };
};
