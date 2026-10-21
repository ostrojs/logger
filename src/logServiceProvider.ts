import ServiceProvider from '@ostro/support/serviceProvider';
import LogManager from './LogManager';

class logServiceProvider extends ServiceProvider {
    declare $app: any;

    /**
     * Register logger service in application container.
     */
    public register(): void {
        this.$app.singleton('logger', function(app: any) {
            return new LogManager(app);
        });
    }
}

export default logServiceProvider;