import { FetchClient, Config } from 'coze-coding-dev-sdk';

const config = new Config();
const client = new FetchClient(config);

const url = 'https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2F%E5%AE%9E%E6%97%B6%E8%A1%8C%E6%83%85%E6%95%B0%E6%8D%AE%E6%8E%A8%E9%80%81%E9%9C%80%E6%B1%82%E6%96%87%E6%A1%A3_v1.0.md_20260727181718399.pdf&nonce=1b1af52c-ee9f-4411-a656-dfc637f870de&project_id=7664246661149147162&sign=b7faf845798130a2d6c856d0e8e795ca791a2c02a34f35f8f28e7da9e88dbee5';

async function main() {
  console.log('正在读取 PDF 文档...');
  
  const response = await client.fetch(url);
  
  console.log(`\n标题：${response.title}`);
  console.log(`状态：${response.status_code === 0 ? '成功' : '失败'}`);
  console.log(`文件类型：${response.filetype}`);
  console.log('\n--- 文档内容 ---\n');
  
  // 提取所有文本内容
  const textContent = response.content
    .filter(item => item.type === 'text')
    .map(item => item.text)
    .join('\n');
  
  console.log(textContent);
}

main().catch(console.error);
