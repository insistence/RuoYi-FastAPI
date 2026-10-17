import "@/assets/styles/components.css";
import { useEffect, useState } from "react";
import { InputNumber, Pagination as AntPagination, Select } from "antd";
export default function Pagination({
  total,
  page = 1,
  limit = 20,
  onChange,
  pageSizes = [10, 20, 30, 50],
}) {
  const [jump, setJump] = useState(page);
  useEffect(() => setJump(page), [page]);
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const changePage = (pageNum, pageSize = limit) => onChange({ pageNum, pageSize });
  const commitJump = () => {
    const next = Math.max(1, Math.min(lastPage, Math.floor(Number(jump) || 1)));
    setJump(next);
    if (next !== page) changePage(next);
  };
  return (
    total > 0 && (
      <div className="pagination">
        <span className="pagination-total">共 {total} 条</span>
        <Select
          aria-label="每页条数"
          value={limit}
          options={[...new Set([...pageSizes, limit])]
            .sort((a, b) => a - b)
            .map((value) => ({ value, label: `${value}条/页` }))}
          onChange={(pageSize) => changePage(page * pageSize > total ? 1 : page, pageSize)}
          style={{ width: 128 }}
        />
        <AntPagination
          total={total}
          current={page}
          pageSize={limit}
          showSizeChanger={false}
          onChange={(pageNum) => changePage(pageNum)}
        />
        <span className="pagination-jumper">
          前往{" "}
          <InputNumber
            aria-label="页"
            value={jump}
            min={1}
            max={lastPage}
            controls={false}
            onChange={setJump}
            onPressEnter={commitJump}
            onBlur={commitJump}
          />{" "}
          页
        </span>
      </div>
    )
  );
}
