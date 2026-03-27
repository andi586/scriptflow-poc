export default function ShotsPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-bold">镜头生成中...</h1>
      <p className="mt-4 text-gray-400">项目 ID: {params.id}</p>
    </div>
  );
}
