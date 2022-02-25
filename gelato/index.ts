import { syncVaultHarvesterTasks } from "./syncVaultHarvesterTasks";

const run = async () => {
    console.log('>>>>>', 'syncVaultHarvesterTasks()');
    await syncVaultHarvesterTasks();
  };
  
run();