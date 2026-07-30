import { FetchClient, Config } from 'coze-coding-dev-sdk';
import * as fs from 'fs';

const config = new Config();
const client = new FetchClient(config);

async function main() {
  console.log('正在读取 PDF 文档...');
  
  const fileBuffer = fs.readFileSync('/tmp/multifactor.pdf');
  const base64 = fileBuffer.toString('base64');
  const dataUri = `data:application/pdf;base64,${base64}`;
  
  const response = await client.fetch(dataUri);
  
  console.log(`\n标题：${response.title}`);
  console.log(`状态：${response.status_code === 0 ? '成功' : '失败'}`);
  console.log(`文件类型：${response.filetype}`);
  console.log('\n--- 文档内容 ---\n');
  
  const textContent = response.content
    .filter(item => item.type === 'text')
    .map(item => item.text)
    .join('\n');
  
  console.log(textContent);
}

main().catch(console.error);
