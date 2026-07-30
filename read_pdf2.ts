import { FetchClient, Config } from 'coze-coding-dev-sdk';

const config = new Config();
const client = new FetchClient(config);

const url = 'https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2F%E5%A4%9A%E5%9B%A0%E5%AD%90%E5%88%86%E6%9E%90%E7%B3%BB%E7%BB%9F%E6%96%B9%E6%A1%88C_v2.1.md.pdf&nonce=1fefc7cc-a6b6-4a9b-a791-060e6cad9f64&project_id=7664246661149147162&sign=59f4450111b37963a5af5005a326618498c84b378461f414e7c51e915007c473';

async function main() {
  console.log('正在读取 PDF 文档...');
  
  const response = await client.fetch(url);
  
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
